import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cleanSourceText, interpret, rank } from "../lib/discovery";
import { assessCandidates } from "../lib/model-review";
import { advance } from "../lib/service";
import { ScanStore } from "../lib/sqlite-store";
import { terminalStages, publicScan, type SourceItem } from "../lib/types";
const description =
  "Our app estimates calories from a food photo instead of manual logging.";
const business = interpret(description);
function post(text: string): SourceItem {
  return {
    id: randomUUID(),
    source: "reddit",
    title: "",
    text,
    url: null,
    publishedAt: null,
    community: null,
    synthetic: true,
  };
}
test("category requests need not name optional offered features, while constraints and unrelated domains are rejected", () => {
  assert.equal(
    rank(
      [post("Looking for a calorie tracking app. Anyone recommend one?")],
      business,
    ).length,
    1,
  );
  for (const text of [
    "Looking for a calorie tracking app, manual-only and without a photo.",
    "Looking for a photo app to edit holiday pictures.",
    "Nutrition matters. I track the weather with an app.",
    "We just launched a calorie tracking app. Sign up now! Anyone recommend it?",
    "Not looking for a calorie tracking app.",
  ]) {
    assert.equal(rank([post(text)], business).length, 0, text);
  }
  const uptime = interpret("Our website uptime monitor sends Slack alerts.");
  for (const text of [
    "Looking for a gaming monitor for my computer.",
    "Looking for a CPU uptime app for a machine, not a website.",
    "Looking for website uptime monitoring, Teams only, not Slack.",
  ])
    assert.equal(rank([post(text)], uptime).length, 0, text);
});
test("replacement requests and first-person problems have distinct evidence; complaints alone are not buying certainty", () => {
  const alternative = rank(
    [
      post(
        "Anyone recommend an alternative calorie tracking app? Current logging takes too long.",
      ),
    ],
    business,
  )[0];
  assert.equal(alternative.need, "Alternative request");
  assert.ok(alternative.text.includes(alternative.evidence));
  const problem = rank(
    [
      post(
        "Struggling with my calorie tracking app because logging takes too long.",
      ),
    ],
    business,
  )[0];
  assert.equal(problem.need, "Problem context");
  assert.equal(
    rank([post("That calorie tracking app is expensive.")], business).length,
    0,
  );
});
test("food-photo estimation questions are problem context, not app requests", () => {
  const item = post(
    "Can anyone help me estimate how many calories I ate from this meal? Before and after photos included.",
  );
  item.title = "Calorie estimate for this meal?";
  const result = rank([item], business)[0];
  assert.equal(result.need, "Problem context");
  assert.ok(result.text.includes(result.evidence));
  assert.equal(
    rank(
      [
        post(
          "I built a calorie estimating app. Can anyone try my food photo tool?",
        ),
      ],
      business,
    ).length,
    0,
  );
});
test("general diet distress and coaching requests do not become software matches", () => {
  for (const text of [
    "I track calories in an app, but I need help losing weight. I feel awful in a deficit.",
    "I'm looking for an online nutrition coach. I already use a food tracking app.",
    "I track meals. I am tired of eggs and need dinner ideas.",
  ]) {
    assert.equal(rank([post(text)], business).length, 0, text);
  }
  assert.equal(
    rank(
      [
        post(
          "Struggling with meal tracking because logging each ingredient takes too long.",
        ),
      ],
      business,
    )[0].need,
    "Problem context",
  );
});
test("ordinary tracking questions and informal friction qualify without app or buying language", () => {
  for (const text of [
    "How do you guys track your calories? This is very hard.",
    "How can I log my meals without spending ages on it?",
    "Tracking calories is so tedious. I struggle to keep it up.",
  ]) {
    const match = rank([post(text)], business)[0];
    assert.ok(match, text);
    assert.equal(match.need, "Problem context", text);
    assert.ok(match.text.includes(match.evidence), text);
    assert.match(match.reason, /Your stated photo-based calorie estimation/);
  }
});
test("query plans pair category phrases with separate signals, preserve rationale and invent no competitor", () => {
  assert.equal(business.queryPlans!.length, 3);
  assert.ok(business.queries[0].includes('"calorie tracking"'));
  assert.deepEqual(
    business.queryPlans!.map((plan) => plan.signal),
    ["recommendation", "recommendation", "problem"],
  );
  assert.ok(business.queryPlans!.every((plan) => plan.rationale.length > 10));
  assert.ok(!business.queries.join(" ").includes("MyFitnessPal"));
});
test("bounded model assessment uses original evidence, rejects uncertainty and refuses fabricated quotations", async () => {
  const candidate = rank(
    [post("Looking for a calorie tracking app. Anyone recommend one?")],
    business,
  )[0];
  const fetcher =
    (decision: string, evidence: string): typeof fetch =>
    async (_url, init) => {
      const input = JSON.parse(init!.body as string);
      assert.equal(input.generationConfig.maxOutputTokens, 512);
      assert.equal(
        (init!.headers as Record<string, string>)["x-goog-api-key"],
        "test-key",
      );
      assert.match(input.systemInstruction.parts[0].text, /untrusted data/);
      return Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    assessments: [
                      {
                        id: candidate.id,
                        decision,
                        signal: "recommendation",
                        evidence,
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      });
    };
  const accepted = await assessCandidates(
    business,
    [candidate],
    "test-key",
    fetcher("accept", "Looking for a calorie tracking app."),
  );
  assert.equal(accepted[0].reviewMethod, "Gemini assessment");
  assert.equal(accepted[0].text, candidate.text);
  assert.equal(
    (
      await assessCandidates(
        business,
        [candidate],
        "test-key",
        fetcher("uncertain", "Looking for a calorie tracking app."),
      )
    ).length,
    0,
  );
  await assert.rejects(
    assessCandidates(
      business,
      [candidate],
      "test-key",
      fetcher("accept", "I want GPS and wearable integration."),
    ),
    /Ungrounded/,
  );
});
test("application review is persisted once, model failure is disclosed and sample mode makes no model calls", async () => {
  const prior = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  try {
    for (const mode of ["live", "sample"] as const)
      for (const fails of [false, true]) {
        const db = new ScanStore(":memory:");
        let reviews = 0;
        const provider = {
          start: async () => ({
            id: "run",
            defaultDatasetId: "data",
            status: "RUNNING",
          }),
          poll: async () => ({
            id: "run",
            defaultDatasetId: "data",
            status: "SUCCEEDED",
          }),
          items: async () => [
            {
              dataType: "post",
              title: "Looking for a calorie tracking app.",
              body: "Anyone recommend a tool?",
              url: "https://www.reddit.com/r/test/comments/abc/request/",
              createdAt: new Date().toISOString(),
            },
          ],
          abort: async () => {},
        };
        const model: typeof assessCandidates = async (
          _business,
          candidates,
        ) => {
          reviews++;
          if (fails) throw Error("private model details");
          return candidates.map((item) => ({
            ...item,
            reviewMethod: "Gemini assessment",
          }));
        };
        try {
          let scan = db.create(
            "owner",
            randomUUID(),
            description,
            mode,
            mode === "live" ? 0.08 : 0,
            1,
          );
          while (!terminalStages.includes(scan.stage))
            scan = await advance(
              scan.id,
              "owner",
              db,
              provider,
              undefined,
              model,
            );
          assert.equal(reviews, mode === "live" ? 1 : 0);
          assert.equal(
            scan.modelReview,
            mode === "live" && !fails
              ? "Gemini + keyword rules"
              : "Keyword rules",
          );
          if (mode === "live" && fails)
            assert.match(scan.notice!, /Keyword checks were retained/);
          await advance(scan.id, "owner", db, provider, undefined, model);
          assert.equal(reviews, mode === "live" ? 1 : 0);
          assert.ok(!JSON.stringify(scan).includes("private model details"));
        } finally {
          db.close();
        }
      }
  } finally {
    if (prior === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prior;
  }
});

test("RSS cleanup preserves the actual words and preview payload withholds extra real matches", () => {
  assert.equal(
    cleanSourceText(
      "I can&#39;t log meals. &#32; submitted by &#32; /u/test [link] [comments]",
    ),
    "I can't log meals.",
  );
  const db = new ScanStore(":memory:");
  try {
    const scan = db.create("owner", randomUUID(), description, "sample", 0);
    scan.results = Array.from({ length: 6 }, (_, i) => ({
      ...rank([post("Looking for a calorie tracking app.")], business)[0],
      id: `match-${i}`,
      text: i < 3 ? "Visible words" : "Private extra result",
    }));
    const payload = publicScan(scan);
    assert.equal(payload.results.length, 3);
    assert.equal(payload.matchCount, 6);
    assert.equal(payload.lockedCount, 3);
    assert.ok(!JSON.stringify(payload).includes("Private extra result"));
    assert.ok(!JSON.stringify(payload).includes("match-5"));
    scan.results = scan.results.slice(0, 2);
    assert.equal(publicScan(scan).lockedCount, 0);
    assert.equal(publicScan(scan).results.length, 2);
  } finally {
    db.close();
  }
});
