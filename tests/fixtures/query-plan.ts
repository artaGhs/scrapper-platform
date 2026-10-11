// Simulated Gemini plans for adapter/auth checks; no paid model or source calls.
export const foodPlan = {
  category: "Food calorie estimation",
  categoryPhrase: "calorie estimator",
  terms: ["calorie", "food", "meal", "nutrition"],
  featureTerms: ["photo"],
  communities: [],
  queries: [
    {
      concepts: [["calorie", "nutrition"], ["photo", "picture"], ["app"]],
      signal: "recommendation",
      rationale: "Food-photo estimation requests.",
      scope: "reddit-wide",
    },
    {
      concepts: [["food", "meal"], ["logging"], ["hard", "tedious"]],
      signal: "problem",
      rationale: "Meal logging friction without naming the product.",
      scope: "reddit-wide",
    },
    {
      concepts: [["calorie"], ["tracking"], ["alternative"]],
      signal: "alternative",
      rationale: "Replacing an existing tracking tool.",
      scope: "reddit-wide",
    },
  ],
};
export const uptimePlan = {
  category: "Website uptime monitoring",
  categoryPhrase: "website availability",
  terms: ["website", "site", "uptime", "downtime"],
  featureTerms: [],
  communities: [],
  queries: [
    {
      concepts: [["uptime"], ["monitor", "alerts"]],
      signal: "recommendation",
      rationale: "Website monitoring product discussions.",
      scope: "reddit-wide",
    },
    {
      concepts: [["website", "site"], ["down"], ["noticed", "notifications"]],
      signal: "problem",
      rationale: "Finding out about website downtime.",
      scope: "reddit-wide",
    },
    {
      concepts: [["website"], ["monitoring"], ["alternative"]],
      signal: "alternative",
      rationale: "Replacing an existing website monitoring tool.",
      scope: "reddit-wide",
    },
  ],
};
export const modelResponse = (plan: unknown) =>
  Response.json({
    candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }],
  });
