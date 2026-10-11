import { test } from "node:test";
import assert from "node:assert/strict";
import { draftQueries } from "../lib/model";
import { interpret } from "../lib/discovery";
test("model query drafting is bounded, server authenticated and retains the observed business", async () => {
  const business = interpret(
    "We estimate calories from food photos instead of manually logging meals.",
  );
  const mock: typeof fetch = async (_url, init) => {
    const input = JSON.parse(init!.body as string);
    assert.equal(input.generationConfig.maxOutputTokens, 512);
    assert.equal(
      (init!.headers as Record<string, string>)["x-goog-api-key"],
      "test-secret",
    );
    return Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({ queries: ["calories food photos app"] }),
              },
            ],
          },
        },
      ],
    });
  };
  const output = await draftQueries(business, "test-secret", mock);
  assert.deepEqual(output.terms, business.terms);
  assert.deepEqual(output.featureTerms, business.featureTerms);
  assert.equal(output.queryMethod, "Gemini draft");
  assert(!JSON.stringify(output).includes("test-secret"));
});
test("model cannot introduce unstated features", async () => {
  const mock: typeof fetch = async () =>
    Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({ queries: ["calorie GPS wearable app"] }),
              },
            ],
          },
        },
      ],
    });
  await assert.rejects(
    draftQueries(
      interpret("Our app estimates calories from food photos."),
      "test-secret",
      mock,
    ),
  );
});
