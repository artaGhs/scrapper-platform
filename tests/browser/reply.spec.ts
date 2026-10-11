import { test, expect } from "@playwright/test";
import type { PublicScan } from "../../lib/types";

const draft =
  "Set up an availability alert so you can check before customers call. Our website monitor sends Slack alerts when a site goes down, which could help here.";
function scan(): PublicScan {
  return {
    id: "reply-test",
    description:
      "Our website monitor sends Slack alerts when a site goes down.",
    mode: "live",
    stage: "complete",
    free: true,
    freeSearchUsed: true,
    results: ["post", "comment", "legacy"].map((kind, index) => ({
      id: `result-${index}`,
      source: kind === "legacy" ? undefined : "reddit",
      kind: kind === "legacy" ? undefined : (kind as "post" | "comment"),
      title: `Outages ${index}`,
      text: "I only notice my site is down when customers call.",
      evidence: "Customers call about downtime.",
      url: null,
      community: "r/smallbusiness",
      publishedAt: null,
      synthetic: false,
      reason: "Availability alerts could help.",
      need: "Problem context",
      score: 90,
      saved: false,
      irrelevant: false,
    })),
  };
}

test("Reddit cards draft on demand, show loading and retry, copy exact text, and restore persisted drafts", async ({
  page,
}) => {
  const stored = scan();
  let requests = 0;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          (window as Window & { copiedReply?: string }).copiedReply = text;
        },
      },
    });
  });
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { freeSearchUsed: true, freeScanId: stored.id } }),
  );
  await page.route("**/api/scans/reply-test", (route) =>
    route.fulfill({ json: stored }),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/scans/reply-test/reply", async (route) => {
    requests++;
    expect(route.request().postDataJSON()).toEqual({ resultId: "result-0" });
    if (requests === 1) {
      await route.fulfill({
        status: 502,
        json: { error: "A reply could not be drafted. Please try again." },
      });
      return;
    }
    await gate;
    stored.results[0].suggestedReply = draft;
    await route.fulfill({ json: { reply: draft } });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Draft reply", exact: true }),
  ).toHaveCount(3);
  expect(requests).toBe(0);
  const card = page.locator("article").first();
  await card.getByRole("button", { name: "Draft reply", exact: true }).click();
  await expect(card.getByRole("alert")).toHaveText(
    "A reply could not be drafted. Please try again.",
  );
  await card.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Drafting…", exact: true }),
  ).toBeDisabled();
  await expect(card.getByRole("status")).toHaveText(
    "Writing a reply for this conversation…",
  );
  release();
  await expect(
    card.getByRole("textbox", { name: "Suggested reply" }),
  ).toHaveValue(draft);
  await card.getByRole("button", { name: "Copy reply", exact: true }).click();
  await expect(card.getByRole("status")).toHaveText("Copied");
  expect(
    await page.evaluate(
      () => (window as Window & { copiedReply?: string }).copiedReply,
    ),
  ).toBe(draft);
  await page.reload();
  await expect(
    card.getByRole("textbox", { name: "Suggested reply" }),
  ).toHaveValue(draft);
  expect(requests).toBe(2);
});

test("clipboard failure selects the draft for manual copy and X cards have no reply action", async ({
  page,
}) => {
  const stored = scan();
  stored.results[0].suggestedReply = draft;
  stored.results[1].source = "x";
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw Error("Denied");
        },
      },
    });
  });
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { freeSearchUsed: true, freeScanId: stored.id } }),
  );
  await page.route("**/api/scans/reply-test", (route) =>
    route.fulfill({ json: stored }),
  );
  await page.goto("/");
  const card = page.locator("article").first();
  await card.getByRole("button", { name: "Copy reply" }).click();
  await expect(card.getByRole("status")).toContainText("copy it manually");
  const field = card.getByRole("textbox", { name: "Suggested reply" });
  await expect(field).toBeFocused();
  expect(
    await field.evaluate(
      (element: HTMLTextAreaElement) =>
        element.selectionEnd - element.selectionStart,
    ),
  ).toBe(draft.length);
  await expect(
    page.locator("article").nth(1).getByText("Suggested reply"),
  ).toHaveCount(0);
});

test("a feedback response started before generation does not hide a completed draft", async ({
  page,
}) => {
  const stored = scan();
  let releaseFeedback!: () => void;
  let feedbackStarted!: () => void;
  const pendingFeedback = new Promise<void>((resolve) => {
    releaseFeedback = resolve;
  });
  const started = new Promise<void>((resolve) => {
    feedbackStarted = resolve;
  });
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { freeSearchUsed: true, freeScanId: stored.id } }),
  );
  await page.route("**/api/scans/reply-test", (route) =>
    route.fulfill({ json: stored }),
  );
  await page.route("**/api/scans/reply-test/feedback", async (route) => {
    stored.results[0].saved = true;
    feedbackStarted();
    await pendingFeedback;
    await route.fulfill({ json: stored });
  });
  await page.route("**/api/scans/reply-test/reply", (route) =>
    route.fulfill({ json: { reply: draft } }),
  );
  await page.goto("/");
  const card = page.locator("article").first();
  await card.getByRole("button", { name: "Save", exact: true }).click();
  await started;
  await card.getByRole("button", { name: "Draft reply", exact: true }).click();
  await expect(
    card.getByRole("textbox", { name: "Suggested reply" }),
  ).toHaveValue(draft);
  releaseFeedback();
  await expect(
    card.getByRole("button", { name: "Saved", exact: true }),
  ).toBeEnabled();
  await expect(
    card.getByRole("textbox", { name: "Suggested reply" }),
  ).toHaveValue(draft);
  await page.getByRole("button", { name: "Saved 1", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(1);
  await expect(
    card.getByRole("textbox", { name: "Suggested reply" }),
  ).toHaveValue(draft);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
