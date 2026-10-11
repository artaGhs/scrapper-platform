import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { attachSession, json, session } from "../lib/http";
import { attachDeveloper, developerSession } from "../lib/developer";

const owner = "a".repeat(64);
const request = (cookie: string) => new NextRequest("https://localhost", { headers: { cookie } });

test("renamed browser sessions preserve ownership and expire the previous cookie", () => {
  const previous = request(`previous_session=${owner}`);
  assert.equal(session(previous), owner);
  const response = attachSession(json({}), owner, previous);
  assert.equal(response.cookies.get("threadfinder_session")?.value, owner);
  assert.equal(response.cookies.get("previous_session")?.value, "");
  assert.equal(session(request(`threadfinder_session=${owner}; previous_session=${"b".repeat(64)}`)), owner);
  assert.equal(session(request(`first_session=${owner}; second_session=${"b".repeat(64)}`)), null);
  assert.equal(session(request("previous_session=invalid")), null);
});

test("renamed developer sessions retain signature and owner validation", () => {
  const prior = process.env.DEVELOPER_ACCESS_KEY;
  process.env.DEVELOPER_ACCESS_KEY = "test-brand-migration-" + "a".repeat(40);
  try {
    const signed = attachDeveloper(json({}), request(""), owner, true);
    const token = signed.cookies.get("threadfinder_developer")!.value;
    const previous = request(`previous_session=${owner}; previous_developer=${token}`);
    assert.equal(developerSession(previous), true);
    assert.equal(developerSession(request(`previous_session=${"b".repeat(64)}; previous_developer=${token}`)), false);
    const migrated = attachDeveloper(attachSession(json({}), owner, previous), previous, owner, true);
    assert.equal(migrated.cookies.get("previous_developer")?.value, "");
    assert.equal(developerSession(request(`threadfinder_session=${owner}; threadfinder_developer=${migrated.cookies.get("threadfinder_developer")!.value}`)), true);
  } finally {
    if (prior === undefined) delete process.env.DEVELOPER_ACCESS_KEY;
    else process.env.DEVELOPER_ACCESS_KEY = prior;
  }
});
