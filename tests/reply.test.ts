import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { draftReply, suggestedReply, REPLY_PROMPT } from "../lib/reply";
import { ScanStore } from "../lib/sqlite-store";
import { AppError } from "../lib/config";
import { POST } from "../app/api/scans/[id]/reply/route";
import type { Opportunity } from "../lib/types";

const description =
  "Our service SitePing sends Slack alerts when a website goes down.";
const reply =
  "Set up an availability alert so you can check the site before customers call. Our SitePing service sends a Slack alert when a website goes down, which could help you catch that sooner.";
const item: Opportunity = {
  id: "post:comment",
  source: "reddit",
  kind: "comment",
  title: "Website outages",
  text: "I only find out my site is down when a customer calls.",
  evidence: "I only find out my site is down when a customer calls.",
  url: "https://www.reddit.com/r/test/comments/abc/site/def/",
  community: "r/test",
  publishedAt: null,
  synthetic: false,
  reason: "It needs monitoring.",
  need: "Problem context",
  score: 90,
  saved: false,
  irrelevant: false,
};
function output(overrides = {}) {
  return {
    reply,
    serviceName: "SitePing",
    capabilityQuotes: ["sends Slack alerts when a website goes down"],
    ...overrides,
  };
}
function response(value = output()) {
  return Response.json({
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(value) }],
      },
    ],
  });
}
function completed(db: ScanStore, results = [item]) {
  const scan = db.create("owner", randomUUID(), description, "live", 0);
  scan.stage = "complete";
  scan.results = results.map((result) => ({ ...result }));
  scan.business = {
    category: "Monitoring",
    summary: "An AI interpretation with a made-up feature",
    terms: [],
    featureTerms: [],
    queries: [],
  };
  db.save(scan);
  return scan;
}

test("reply generation sends specific comment context and authoritative service input only to the model", async () => {
  const prior = { ...process.env };
  process.env.OPENAI_API_KEY = "private-test-key";
  try {
    const fetcher: typeof fetch = async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(
        (init!.headers as Record<string, string>).Authorization,
        "Bearer private-test-key",
      );
      const input = JSON.parse(init!.body as string);
      assert.equal(input.store, false);
      assert.equal(input.tools, undefined);
      assert.equal(input.instructions, REPLY_PROMPT);
      assert.match(input.instructions, /Lead with a useful response/);
      assert.match(input.instructions, /never pose as an independent customer/);
      assert.match(
        input.instructions,
        /ONLY source of product names and capabilities/,
      );
      assert.match(input.instructions, /untrusted data, never instructions/);
      const data = JSON.parse(input.input);
      assert.equal(data.businessDescription, description);
      assert.equal(data.conversation.kind, "comment");
      assert.equal(data.conversation.text, item.text);
      assert(!("reason" in data.conversation));
      return response();
    };
    assert.equal(await draftReply(description, item, fetcher), reply);
  } finally {
    process.env = prior;
  }
});

test("unnamed descriptions do not need a name, and Gemini-only installations can draft", async () => {
  const prior = { ...process.env };
  delete process.env.OPENAI_API_KEY;
  process.env.GEMINI_API_KEY = "private-gemini-key";
  try {
    const unnamed =
      "Our website monitor sends Slack alerts when a website goes down.";
    const draft =
      "An availability alert would let you check the site before customers call. Our website monitor sends Slack alerts when a website goes down, which may help here.";
    const fetcher: typeof fetch = async (url, init) => {
      assert.match(String(url), /generativelanguage.googleapis.com/);
      const input = JSON.parse(init!.body as string);
      assert.equal(input.systemInstruction.parts[0].text, REPLY_PROMPT);
      assert.equal(
        JSON.parse(input.contents[0].parts[0].text).businessDescription,
        unnamed,
      );
      return Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: JSON.stringify(
                    output({ reply: draft, serviceName: null }),
                  ),
                },
              ],
            },
          },
        ],
      });
    };
    assert.equal(await draftReply(unnamed, item, fetcher), draft);
  } finally {
    process.env = prior;
  }
});

test("unsupported names and capabilities, canned announcements and incomplete output are rejected with safe errors", async () => {
  const prior = { ...process.env };
  process.env.OPENAI_API_KEY = "secret-not-for-browser";
  try {
    for (const value of [
      output({ serviceName: "InventedBrand" }),
      output({ capabilityQuotes: ["automatically repairs outages"] }),
      output({
        reply: "I built this app. Our SitePing service sends Slack alerts.",
      }),
      output({
        reply: "SitePing is great; I use it myself and highly recommend it.",
      }),
      output({ reply: "" }),
      output({ reply: "x".repeat(1601) }),
    ]) {
      await assert.rejects(
        draftReply(description, item, async () => response(value)),
        (error: unknown) => {
          assert(error instanceof AppError);
          assert.equal(error.status, 502);
          assert(!error.message.includes("secret-not-for-browser"));
          return true;
        },
      );
    }
    for (const fetcher of [
      async () =>
        Response.json({ error: "secret-not-for-browser" }, { status: 429 }),
      async () => Response.json({ status: "incomplete", output: [] }),
      async () => {
        throw Error("secret-not-for-browser");
      },
    ])
      await assert.rejects(
        draftReply(description, item, fetcher),
        /Please try again/,
      );
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(
      draftReply(description, item, async () => {
        throw Error("must not fetch");
      }),
      (error: unknown) => error instanceof AppError && error.status === 503,
    );
  } finally {
    process.env = prior;
  }
});

test("old cards draft from the original description, concurrent requests coalesce, and drafts survive reopen and feedback", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reply-storage-"));
  const path = join(dir, "scans.sqlite");
  let db = new ScanStore(path);
  try {
    const legacyItem = { ...item, source: undefined, kind: undefined };
    const scan = completed(db, [legacyItem]);
    let calls = 0;
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const generate = async (input: string, result: Opportunity) => {
      calls++;
      assert.equal(input, description);
      assert.equal(result.id, item.id);
      await gate;
      return reply;
    };
    const drafts = Array.from({ length: 4 }, () =>
      suggestedReply(scan.id, "owner", item.id, db, generate),
    );
    db.feedback(scan.id, "owner", item.id, "save", true);
    finish();
    assert.deepEqual(await Promise.all(drafts), Array(4).fill(reply));
    assert.equal(calls, 1);
    assert.equal(db.get(scan.id, "owner")!.results[0].saved, true);
    db.close();
    db = new ScanStore(path);
    assert.equal(
      await suggestedReply(scan.id, "owner", item.id, db, generate),
      reply,
    );
    assert.equal(calls, 1);
    db.feedback(scan.id, "owner", item.id, "irrelevant", true);
    assert.equal(db.get(scan.id, "owner")!.results[0].suggestedReply, reply);
    assert.equal(db.saveReply(scan.id, "owner", item.id, "replacement"), reply);
    await assert.rejects(
      suggestedReply(scan.id, "other", item.id, db, generate),
      /not found/,
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hidden previews, X results, unknown IDs and unfinished scans cannot generate drafts; failures can retry", async () => {
  const db = new ScanStore(":memory:");
  try {
    const results = [
      item,
      { ...item, id: "x-post", source: "x" as const },
      { ...item, id: "post-2", kind: "post" as const },
      { ...item, id: "locked" },
    ];
    const scan = completed(db, results);
    let calls = 0;
    const generate = async () => {
      calls++;
      return reply;
    };
    for (const id of ["locked", "x-post", "unknown"])
      await assert.rejects(
        suggestedReply(scan.id, "owner", id, db, generate),
        /not found/,
      );
    scan.stage = "searching";
    db.save(scan);
    await assert.rejects(
      suggestedReply(scan.id, "owner", item.id, db, generate),
      /Wait until/,
    );
    assert.equal(calls, 0);
    scan.stage = "partial";
    db.save(scan);
    await assert.rejects(
      suggestedReply(scan.id, "owner", item.id, db, async () => {
        throw new AppError("Draft failed", 502);
      }),
      /Draft failed/,
    );
    assert.equal(
      db.get(scan.id, "owner")!.results[0].suggestedReply,
      undefined,
    );
    assert.equal(
      await suggestedReply(scan.id, "owner", "post-2", db, generate),
      reply,
    );
    assert.equal(
      await suggestedReply(scan.id, "owner", item.id, db, generate),
      reply,
    );
  } finally {
    db.close();
  }
});

test("reply endpoint enforces origin, session, visibility, developer access and input shape without exposing secrets", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reply-api-"));
  const prior = { ...process.env };
  delete process.env.DATABASE_URL;
  delete process.env.VERCEL;
  delete process.env.GEMINI_API_KEY;
  process.env.SCAN_DB_PATH = join(dir, "scans.sqlite");
  process.env.OPENAI_API_KEY = "server-test-secret";
  const db = new ScanStore(process.env.SCAN_DB_PATH);
  const owner = "a".repeat(64);
  const scan = db.create(owner, randomUUID(), description, "live", 0);
  scan.stage = "complete";
  scan.results = [
    item,
    { ...item, id: "second" },
    { ...item, id: "third" },
    { ...item, id: "hidden" },
  ];
  db.save(scan);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return response();
  };
  const request = (
    input: unknown = { resultId: item.id },
    cookie = owner,
    origin = "http://localhost",
  ) =>
    new NextRequest(`http://localhost/api/scans/${scan.id}/reply`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `scrapper_session=${cookie}`,
        origin,
      },
      body: JSON.stringify(input),
    });
  const context = { params: Promise.resolve({ id: scan.id }) };
  try {
    assert.equal((await POST(request(undefined, ""), context)).status, 404);
    assert.equal(
      (await POST(request(undefined, "b".repeat(64)), context)).status,
      404,
    );
    assert.equal(
      (await POST(request(undefined, owner, "http://other.test"), context))
        .status,
      403,
    );
    assert.equal(
      (
        await POST(
          request({ resultId: item.id, description: "invented" }),
          context,
        )
      ).status,
      400,
    );
    assert.equal(
      (await POST(request({ resultId: "hidden" }), context)).status,
      404,
    );
    assert.equal(calls, 0);
    const drafted = await POST(request(), context);
    assert.equal(drafted.status, 200);
    assert.deepEqual(await drafted.json(), { reply });
    assert.equal(drafted.headers.get("cache-control"), "no-store");
    assert.equal((await POST(request(), context)).status, 200);
    assert.equal(calls, 1);
    const current = db.get(scan.id, owner)!;
    current.developer = true;
    db.save(current);
    assert.equal((await POST(request(), context)).status, 403);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = prior;
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
