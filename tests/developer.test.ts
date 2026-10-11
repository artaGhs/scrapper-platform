import test from "node:test";
import { foodPlan, modelResponse } from "./fixtures/query-plan";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import {
  attachDeveloper,
  developerSession,
  validDeveloperKey,
} from "../lib/developer";
import { json } from "../lib/http";
import { ScanStore } from "../lib/sqlite-store";
import { advance } from "../lib/service";
import { publicScan, terminalStages } from "../lib/types";
import { store } from "../lib/store";
import { POST as login, DELETE as logout } from "../app/api/developer/route";
import { POST as create } from "../app/api/scans/route";
import { POST as progress, GET as read } from "../app/api/scans/[id]/route";
import { POST as feedback } from "../app/api/scans/[id]/feedback/route";
import { GET as session } from "../app/api/session/route";
const description =
  "Our app estimates calories from food photos instead of manual meal logging.";
const secret = "test-developer-key-with-64-characters-" + "a".repeat(32);
const owner = "a".repeat(64);
function req(
  path: string,
  cookie = "",
  payload?: unknown,
  method = payload ? "POST" : "GET",
) {
  return new NextRequest("https://localhost" + path, {
    method,
    headers: {
      cookie,
      "content-type": "application/json",
      origin: "https://localhost",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
}
test("developer authentication rejects forged, expired, cross-session, disabled and rotated credentials", () => {
  const prior = process.env.DEVELOPER_ACCESS_KEY;
  const now = Date.now;
  process.env.DEVELOPER_ACCESS_KEY = secret;
  try {
    assert(validDeveloperKey(secret));
    assert(!validDeveloperKey("wrong"));
    const response = attachDeveloper(json({}), req("/"), owner, true);
    const value = response.cookies.get("threadfinder_developer")!.value;
    const cookie = `threadfinder_session=${owner}; threadfinder_developer=${value}`;
    assert(developerSession(req("/", cookie)));
    assert.match(
      response.headers.get("set-cookie")!,
      /(?=.*HttpOnly)(?=.*Secure)(?=.*SameSite=strict)/i,
    );
    assert(!response.headers.get("set-cookie")!.includes(secret));
    assert(
      !developerSession(
        req(
          "/",
          `threadfinder_session=${"b".repeat(64)}; threadfinder_developer=${value}`,
        ),
      ),
    );
    assert(
      !developerSession(
        req(
          "/",
          cookie.replace(
            value,
            value.slice(0, -1) + (value.endsWith("a") ? "b" : "a"),
          ),
        ),
      ),
    );
    Date.now = () => now() + 8 * 86400_000;
    assert(!developerSession(req("/", cookie)));
    Date.now = now;
    process.env.DEVELOPER_ACCESS_KEY = secret + "rotated";
    assert(!developerSession(req("/", cookie)));
    delete process.env.DEVELOPER_ACCESS_KEY;
    assert(!developerSession(req("/", cookie)));
    assert(!validDeveloperKey(secret));
  } finally {
    Date.now = now;
    if (prior === undefined) delete process.env.DEVELOPER_ACCESS_KEY;
    else process.env.DEVELOPER_ACCESS_KEY = prior;
  }
});
test("repeated developer runs bypass quotas, keep idempotency and preserve consumed free allowance and public capacity", async () => {
  const db = new ScanStore(":memory:");
  const admission = { ipHash: "shared", dailyBudget: 0.12, free: true };
  const provider = {
    start: async () => ({
      id: "mock-run",
      defaultDatasetId: "mock-data",
      status: "RUNNING",
    }),
    poll: async () => ({
      id: "mock-run",
      defaultDatasetId: "mock-data",
      status: "SUCCEEDED",
    }),
    items: async () => [],
    abort: async () => {},
  };
  try {
    const first = db.create(
      owner,
      randomUUID(),
      description,
      "live",
      0.12,
      0.12,
      ["reddit"],
      admission,
    );
    db.consumeFree(first);
    first.stage = "empty";
    db.save(first);
    const originalAllowance = db.allowance(owner);
    const ids = new Set<string>();
    for (let i = 0; i < 25; i++) {
      let scan = db.create(
        owner,
        randomUUID(),
        description,
        "live",
        0.12,
        0.12,
        ["reddit"],
        { ...admission, developer: true },
      );
      assert(scan.developer);
      ids.add(scan.id);
      assert.equal(
        db.create(
          owner,
          scan.key,
          description,
          "live",
          0.12,
          0.12,
          ["reddit"],
          { ...admission, developer: true },
        ).id,
        scan.id,
      );
      while (!terminalStages.includes(scan.stage))
        scan = await advance(scan.id, owner, db, provider);
      assert.equal(scan.stage, "empty");
      assert.equal(publicScan(scan).freeSearchUsed, false);
      assert.deepEqual(db.allowance(owner), originalAllowance);
    }
    assert.equal(ids.size, 25);
    assert.throws(
      () =>
        db.create(
          owner,
          randomUUID(),
          description + " Again",
          "live",
          0.12,
          0.24,
          ["reddit"],
          { ...admission, dailyBudget: 0.24 },
        ),
      /free search has already been used/,
    );
    const publicRun = db.create(
      "visitor",
      randomUUID(),
      description,
      "live",
      0.12,
      0.24,
      ["reddit"],
      { ...admission, dailyBudget: 0.24 },
    );
    assert(!publicRun.developer);
    assert.throws(
      () =>
        db.create(
          "next-visitor",
          randomUUID(),
          description,
          "live",
          0.12,
          0.24,
          ["reddit"],
          { ...admission, dailyBudget: 0.24 },
        ),
      /capacity is full/,
    );
  } finally {
    db.close();
  }
});
test("API authenticates developer bypass server-side, ignores forged client claims, and requires login to advance developer scans", async () => {
  const prior = { ...process.env },
    dir = mkdtempSync(join(tmpdir(), "developer-api-"));
  delete process.env.DATABASE_URL;
  delete process.env.VERCEL;
  Object.assign(process.env, {
    SCAN_DB_PATH: join(dir, "scans.sqlite"),
    APIFY_TOKEN: "test-private-token",
    GEMINI_API_KEY: "test-model-key",
    DEVELOPER_ACCESS_KEY: secret,
    LIVE_SCAN_BUDGET_USD: "0.12",
    LIVE_HOURLY_BUDGET_USD: "1",
    LIVE_DAILY_BUDGET_USD: "5",
  });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let plans = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes("generativelanguage.googleapis.com")) {
      plans++;
      return modelResponse(foodPlan);
    }
    calls++;
    throw Error("No source call authorized");
  };
  try {
    const anonymousCookie = `threadfinder_session=${owner}`;
    assert.equal(
      (
        await create(
          req("/api/scans", anonymousCookie, {
            description,
            mode: "sample",
            key: randomUUID(),
          }),
        )
      ).status,
      403,
    );
    const firstResponse = await create(
      req("/api/scans", anonymousCookie, {
        description,
        mode: "live",
        key: randomUUID(),
      }),
    );
    assert.equal(firstResponse.status, 201);
    const first = await firstResponse.json();
    const db = await store();
    const privateFirst = (await db.get(first.id, owner))!;
    await db.consumeFree(privateFirst);
    privateFirst.stage = "empty";
    await db.save(privateFirst);
    assert.equal(
      (
        await create(
          req("/api/scans", anonymousCookie, {
            description: description + " Again",
            mode: "live",
            key: randomUUID(),
          }),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await login(
          req("/api/developer", anonymousCookie, { key: secret + "wrong" }),
        )
      ).status,
      401,
    );
    const response = await login(
      req("/api/developer", anonymousCookie, { key: secret }),
    );
    assert.equal(response.status, 200);
    const token = response.cookies.get("threadfinder_developer")!.value;
    const cookie = anonymousCookie + `; threadfinder_developer=${token}`;
    const sampleResponse = await create(
      req("/api/scans", cookie, {
        description,
        mode: "sample",
        key: randomUUID(),
      }),
    );
    assert.equal(sampleResponse.status, 201);
    const sample = await sampleResponse.json();
    assert(sample.developer);
    const legacySample = await db.create(
      owner,
      randomUUID(),
      description,
      "sample",
      0,
    );
    for (const id of [sample.id, legacySample.id]) {
      const params = { params: Promise.resolve({ id }) };
      assert.equal(
        (await read(req(`/api/scans/${id}`, anonymousCookie), params)).status,
        403,
      );
      assert.equal(
        (
          await progress(
            req(`/api/scans/${id}`, anonymousCookie, {}, "POST"),
            params,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await feedback(
            req(`/api/scans/${id}/feedback`, anonymousCookie, {
              resultId: "sample-result",
              action: "save",
              value: true,
            }),
            params,
          )
        ).status,
        403,
      );
      assert.equal(
        (await read(req(`/api/scans/${id}`, cookie), params)).status,
        200,
      );
    }
    const state = await (await session(req("/api/session", cookie))).json();
    assert(state.developer);
    assert.equal(state.freeSearchUsed, false);
    const ids = [];
    for (let i = 0; i < 2; i++) {
      const res = await create(
        req("/api/scans", cookie, {
          description,
          mode: "live",
          key: randomUUID(),
        }),
      );
      assert.equal(res.status, 201);
      const scan = await res.json();
      assert(scan.developer);
      ids.push(scan.id);
    }
    assert.notEqual(ids[0], ids[1]);
    assert((await db.allowance(owner)).used);
    assert.equal(
      (
        await create(
          req("/api/scans", anonymousCookie, {
            description,
            mode: "live",
            key: randomUUID(),
            developer: true,
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await progress(
          req(`/api/scans/${ids[0]}`, anonymousCookie, {}, "POST"),
          { params: Promise.resolve({ id: ids[0] }) },
        )
      ).status,
      403,
    );
    const signedProgress = await progress(
      req(`/api/scans/${ids[0]}`, cookie, {}, "POST"),
      { params: Promise.resolve({ id: ids[0] }) },
    );
    assert.equal(signedProgress.status, 200);
    assert.equal((await signedProgress.json()).stage, "preparing");
    const crossOrigin = req("/api/developer", cookie, { key: secret });
    crossOrigin.headers.set("origin", "https://attacker.invalid");
    assert.equal((await login(crossOrigin)).status, 403);
    const exited = await logout(
      req("/api/developer", cookie, undefined, "DELETE"),
    );
    assert.equal(exited.cookies.get("threadfinder_developer")?.value, "");
    assert.equal(
      (await (await session(req("/api/session", anonymousCookie))).json())
        .freeSearchUsed,
      true,
    );
    assert.equal(calls, 0);
    assert.equal(plans, 1);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = prior;
    rmSync(dir, { recursive: true, force: true });
  }
});
