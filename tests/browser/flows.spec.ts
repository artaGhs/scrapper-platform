import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";

async function capture(page: Page, name: string) {
  if (process.env.CAPTURE_SCREENSHOTS !== "1") return;
  mkdirSync("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: `docs/screenshots/${name}.png`,
    fullPage: true,
  });
}

test("sample input → progress → results, save, feedback, persistence and source truth", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Food photo app" }).click();
  await expect(page.getByRole("button", { name: "Run search" })).toBeEnabled();
  await capture(page, "desktop");
  await page.getByRole("button", { name: "Run search" }).click();
  await expect(page.getByRole("status")).toContainText(
    /Reading|Preparing|Loading|Reviewing|Checking/,
  );
  await expect(page.locator(".progress-rail")).toBeInViewport();
  await expect(
    page.getByRole("heading", { name: "3 examples worth a closer look." }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator("article")).toHaveCount(3);
  await expect(
    page.locator("article").getByText("Fictional example"),
  ).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Open original" })).toHaveCount(
    0,
  );
  await page
    .locator("article")
    .first()
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page
      .locator("article")
      .first()
      .getByRole("button", { name: "Saved", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Saved 1", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(1);
  await page
    .locator("article")
    .first()
    .getByRole("button", { name: "Not relevant" })
    .click();
  await expect(
    page.getByRole("button", { name: "Undo feedback" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator("article")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Undo feedback" })).toHaveCount(
    1,
  );
  await capture(page, "results");
  expect(errors).toEqual([]);
});

test("empty fixtures and disabled live configuration remain truthful", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("What do you offer, and who is it for?")
    .fill(
      "We manufacture custom ceramic kitchen tiles for architects and interior designers.",
    );
  await page.getByRole("button", { name: "Run search" }).click();
  await expect(
    page.getByRole("heading", { name: "No strong matches this time." }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByLabel("Live search", { exact: true }).check();
  await page.getByRole("button", { name: "Run search" }).click();
  await expect(page.locator(".error-message[role=alert]")).toContainText(
    /budget|connected|pilot access/,
  );
  await expect(page.locator("article")).toHaveCount(0);
});

test("mobile keyboard flow and reduced motion have no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Run search" })).toBeInViewport(
    { ratio: 1 },
  );
  await capture(page, "mobile-start");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to business description" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByLabel("What do you offer, and who is it for?"),
  ).toBeFocused();
  await page.getByRole("button", { name: "Uptime monitor" }).click();
  await page.getByRole("button", { name: "Run search" }).click();
  await expect(
    page.getByRole("heading", { name: "3 examples worth a closer look." }),
  ).toBeVisible({ timeout: 15000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const animated = await page
    .locator(".stage-node")
    .evaluateAll((nodes) =>
      nodes.some((node) => getComputedStyle(node).animationName !== "none"),
    );
  expect(animated).toBe(false);
  await capture(page, "mobile");
});

test("HTTP ownership, idempotency, read-only GET, origin and input bounds", async ({
  request,
  playwright,
}) => {
  await request.get("/api/session");
  const input = {
    description:
      "Our Shopify app sends unique discount codes in welcome emails.",
    mode: "sample",
    key: randomUUID(),
  };
  const first = await request.post("/api/scans", { data: input });
  expect(first.status()).toBe(201);
  const scan = await first.json();
  const duplicate = await request.post("/api/scans", { data: input });
  expect((await duplicate.json()).id).toBe(scan.id);
  const snapshot = await request.get(`/api/scans/${scan.id}`);
  expect((await snapshot.json()).stage).toBe("interpreting");
  const other = await playwright.request.newContext({
    baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:3173",
  });
  await other.get("/api/session");
  expect((await other.get(`/api/scans/${scan.id}`)).status()).toBe(404);
  await other.dispose();
  expect(
    (
      await request.post("/api/scans", {
        data: input,
        headers: { Origin: "https://other.example" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/scans", {
        data: { ...input, description: "short" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/scans", {
        data: { ...input, description: "x".repeat(9000) },
      })
    ).status(),
  ).toBe(413);
});

test("launch is Reddit only and preserves real provenance on partial retrieval", async ({
  page,
}) => {
  // Presentation fixture only; independently verified live results are recorded separately.
  const scan = {
    id: "simulated-browser-scan",
    description: "Our website uptime monitor sends alerts.",
    mode: "live",
    sources: ["reddit"],
    stage: "partial",
    sourceRuns: [
      {
        source: "reddit",
        status: "partial",
        retrieved: 1,
        normalized: 1,
        error:
          "The source reached its time limit; this does not confirm an empty search.",
      },
    ],
    results: [
      {
        id: "reddit:abc",
        source: "reddit",
        title: "A request on Reddit",
        text: "Looking for an uptime monitor with website alerts.",
        url: "https://www.reddit.com/r/test/comments/abc/request/",
        publishedAt: "2026-09-28T15:00:00.000Z",
        community: "r/test",
        synthetic: false,
        reason: "Requests uptime monitoring with alerts.",
        evidence: "Looking for",
        need: "Solution request",
        score: 80,
        saved: false,
        irrelevant: false,
        reviewMethod: "Keyword rules",
      },
    ],
    retrieved: 1,
    notice:
      "Some source work could not finish. Only returned records were reviewed.",
  };
  await page.route("**/api/scans", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(scan),
    }),
  );
  await page.goto("/");
  await expect(page.getByLabel("Search in", { exact: true })).toHaveCount(0);
  await expect(page.getByText("X · experimental", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Uptime monitor" }).click();
  await page.getByLabel("Live search", { exact: true }).check();
  await page.getByRole("button", { name: "Run search" }).click();
  await expect(
    page.getByRole("heading", { name: "1 matches worth a closer look." }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Source progress" }),
  ).toContainText("does not confirm an empty search");
  await expect(
    page.getByRole("link", { name: "Open original" }),
  ).toHaveAttribute("href", scan.results[0].url);
  await expect(page.locator("article")).toContainText("2026");
  await expect(page.locator("article")).toContainText("Keyword rules");
});
