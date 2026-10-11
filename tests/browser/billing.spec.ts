import { test, expect } from "@playwright/test";

test("unsigned customers can start a trial without opening checkout", async ({ page }) => {
  await page.route("**/api/session", route => route.fulfill({json: {
    billingEnabled: true, billingMode: "live", signedIn: false,
  }}));
  await page.goto("/billing");
  await expect(page.getByRole("region", {name: "Plan summary"})).toContainText("7-day free trial");
  await expect(page.getByRole("region", {name: "Plan summary"})).toContainText("Starter: $10/month for 10 searches");
  await expect(page.getByRole("region", {name: "Plan summary"})).toContainText("Pro: $24/month for 30 searches");
  await expect(page.getByRole("link", {name: "Sign in or create an account"})).toHaveAttribute("href", "/api/auth/login?next=/billing");
  await expect(page.getByRole("button", {name: "Choose a plan"})).toHaveCount(0);
});

test("disabled billing offers no checkout and keeps free research available", async ({
  page,
}) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { ready: true, billingEnabled: false } }),
  );
  await page.goto("/billing");
  await expect(page.getByRole("status")).toContainText(
    "Your free search remains available",
  );
  await expect(
    page.getByRole("button", { name: "Choose a plan" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Back to ThreadFinder" }),
  ).toHaveAttribute("href", "/");
});

test("checkout retries mint a new session and show service failures without leaving the app", async ({
  page,
}) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { ready: true, billingEnabled: true, signedIn: true } }),
  );
  const requests: unknown[] = [];
  await page.route("**/api/billing/session", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 503,
      json: { error: "Billing is temporarily unavailable." },
    });
  });
  await page.goto("/billing");
  await page.getByRole("button", { name: "Choose a plan" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Billing is temporarily unavailable.",
  );
  await page.getByRole("button", { name: "Choose a plan" }).click();
  await expect.poll(() => requests.length).toBe(2);
  await expect(
    page.getByRole("button", { name: "Manage subscription" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Manage subscription" }).click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests).toEqual([
    { destination: "pricing" },
    { destination: "pricing" },
    { destination: "portal" },
  ]);
  await expect(page).toHaveURL(/\/billing$/);
});

test("checkout rejects unsafe redirect URLs", async ({ page }) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { ready: true, billingEnabled: true, signedIn: true } }),
  );
  await page.route("**/api/billing/session", (route) =>
    route.fulfill({ json: { url: "javascript:alert(1)" } }),
  );
  await page.goto("/billing");
  await page.getByRole("button", { name: "Choose a plan" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "The billing session could not be opened.",
  );
  await expect(page).toHaveURL(/\/billing$/);
});
