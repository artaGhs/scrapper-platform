import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { draftQueries } from "../lib/model";
import { interpret } from "../lib/discovery";
import { advance } from "../lib/service";
import { ScanStore } from "../lib/sqlite-store";

const description =
  "Our appointment reminders help dentists reduce missed appointments by sending SMS reminders.";
function plan() {
  return {
    category: "Dental appointment reminders",
    categoryPhrase: "appointment reminder",
    terms: [
      "dentist",
      "dental",
      "appointment",
      "no show",
      "missed appointment",
    ],
    featureTerms: ["SMS reminders"],
    communities: ["dentistry", "smallbusiness"],
    queries: [
      {
        concepts: [
          ["dental", "dentist"],
          ["appointment reminder", "SMS reminder"],
        ],
        signal: "recommendation",
        rationale: "Dental practices discussing reminder tools.",
        scope: "reddit-wide",
      },
      {
        concepts: [
          ["dentist", "dental"],
          ["no show", "missed appointment"],
        ],
        signal: "problem",
        rationale: "Missed appointments without requiring product terminology.",
        scope: "reddit-wide",
      },
      {
        concepts: [["appointment"], ["reminders"]],
        signal: "alternative",
        rationale: "An additional focused reminder-workflow query.",
        scope: "focused",
      },
    ],
  };
}
const expectedQueries = [
  '(dental OR dentist) AND ("appointment reminder" OR "SMS reminder")',
  '(dentist OR dental) AND ("no show" OR "missed appointment")',
  "appointment AND reminders AND (subreddit:dentistry OR subreddit:smallbusiness)",
];
function response(value: unknown) {
  return Response.json({
    candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
  });
}
test("Gemini interprets a novel business and chooses bounded diverse searches without receiving category templates", async () => {
  const business = interpret(description);
  const mock: typeof fetch = async (_url, init) => {
    const input = JSON.parse(init!.body as string);
    assert.equal(input.generationConfig.maxOutputTokens, 1400);
    assert.equal(
      (init!.headers as Record<string, string>)["x-goog-api-key"],
      "test-secret",
    );
    assert.deepEqual(JSON.parse(input.contents[0].parts[0].text), {
      description,
    });
    assert(!JSON.stringify(input.contents).includes(business.queries[0]));
    return response(plan());
  };
  const output = await draftQueries(business, "test-secret", mock);
  assert.equal(output.category, "Dental appointment reminders");
  assert(output.terms.includes("no show"));
  assert.deepEqual(output.featureTerms, ["sms reminders"]);
  assert.equal(output.queryMethod, "Gemini draft");
  assert.equal(output.searchScope, "reddit-wide");
  assert.deepEqual(output.queries, expectedQueries);
  assert(
    output.queries.slice(0, 2).every((query) => !query.includes("subreddit:")),
  );
  assert(!output.queries[1].includes("appointment reminder"));
  assert(!JSON.stringify(output).includes("test-secret"));
});
test("model plans reject unstated features, missing broad scope, unsupported syntax and duplicate searches", async () => {
  const invalid: Array<ReturnType<typeof plan>> = [];
  let value = plan();
  value.featureTerms = ["GPS wearable integration"];
  invalid.push(value);
  value = plan();
  value.queries[0].scope = "focused";
  invalid.push(value);
  value = plan();
  value.queries[0].concepts = [["dentist"], ["subreddit:dentistry"]];
  invalid.push(value);
  value = plan();
  value.queries[0].concepts = [["dentist"], ["author:someone"]];
  invalid.push(value);
  value = plan();
  value.queries[0].concepts = [["dentist"], ["(appointment"]];
  invalid.push(value);
  value = plan();
  value.queries[0].concepts = [["dentist"], ["AND OR"]];
  invalid.push(value);
  value = plan();
  value.queries[1] = value.queries[0];
  invalid.push(value);
  value = plan();
  value.queries[0].concepts = [["dentist"], ['"appointment']];
  invalid.push(value);
  value = plan();
  value.queries[0].concepts = [["dentist"], ["https://example.com"]];
  invalid.push(value);
  value = plan();
  value.queries[0].concepts = [["dentist"], []];
  invalid.push(value);
  value = plan();
  value.queries[0].concepts = [["dentist"], ["a full sentence of many words"]];
  invalid.push(value);
  for (const invalidPlan of invalid)
    await assert.rejects(
      draftQueries(interpret(description), "test-secret", async () =>
        response(invalidPlan),
      ),
    );
});
test("production interpreting actually calls Gemini once without a draft injection and persists its plan", async () => {
  const priorKey = process.env.GEMINI_API_KEY;
  const priorFetch = globalThis.fetch;
  const db = new ScanStore(":memory:");
  process.env.GEMINI_API_KEY = "test-secret";
  let calls = 0;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /generativelanguage.googleapis.com/);
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return response(plan());
  };
  try {
    const created = db.create(
      "owner",
      randomUUID(),
      description,
      "live",
      0.12,
      1,
      ["reddit"],
      { free: true, ipHash: "ip", dailyBudget: 5 },
    );
    await Promise.all(
      Array.from({ length: 5 }, () => advance(created.id, "owner", db)),
    );
    const stored = db.get(created.id, "owner")!;
    assert.equal(calls, 1);
    assert.equal(stored.stage, "preparing");
    assert.equal(stored.business!.queryMethod, "Gemini draft");
    assert.deepEqual(stored.sourceRuns![0].queries, expectedQueries);
    assert.deepEqual(stored.sourceRuns![0].searchKinds, ["post", "comment"]);
    assert.equal(stored.startAttempted, undefined);
    assert.equal(db.allowance("owner").used, false);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = priorKey;
    db.close();
  }
});
test("production planner failure or missing key starts no source job and preserves the free allowance and source budget", async () => {
  const priorKey = process.env.GEMINI_API_KEY;
  const priorFetch = globalThis.fetch;
  try {
    for (const missing of [false, true]) {
      if (missing) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = "test-secret";
      let calls = 0;
      globalThis.fetch = async (url) => {
        assert.match(String(url), /generativelanguage.googleapis.com/);
        calls++;
        throw Error("private model diagnostic test-secret");
      };
      const db = new ScanStore(":memory:");
      try {
        const created = db.create(
          "owner",
          randomUUID(),
          description,
          "live",
          0.12,
          1,
          ["reddit"],
          { free: true, ipHash: "ip", dailyBudget: 5 },
        );
        const failed = await advance(created.id, "owner", db);
        assert.equal(failed.stage, "failed");
        assert.equal(failed.sourceRuns![0].status, "failed");
        assert.match(failed.error!, /no Reddit search was started/);
        assert.equal(failed.reservedUsd, 0);
        assert.equal(failed.startAttempted, false);
        assert.equal(db.allowance("owner").used, false);
        assert.equal(failed.business, undefined);
        assert(!JSON.stringify(failed).includes("test-secret"));
        await advance(failed.id, "owner", db);
        assert.equal(calls, missing ? 0 : 1);
        assert.notEqual(
          db.create(
            "owner",
            randomUUID(),
            description,
            "live",
            0.12,
            1,
            ["reddit"],
            { free: true, ipHash: "ip", dailyBudget: 5 },
          ).id,
          failed.id,
        );
      } finally {
        db.close();
      }
    }
  } finally {
    globalThis.fetch = priorFetch;
    if (priorKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = priorKey;
  }
});
