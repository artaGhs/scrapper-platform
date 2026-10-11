import { loadEnvConfig } from "@next/env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { draftQueries } from "../lib/model";
import { interpret } from "../lib/discovery";
loadEnvConfig(process.cwd());
async function main() {
  const path = ".data/model-validation.json";
  if (existsSync(path)) {
    console.log(readFileSync(path, "utf8"));
    return;
  }
  if (!process.argv.includes("--confirm-live") || !process.env.GEMINI_API_KEY)
    throw new Error("Validation is not authorized or configured.");
  mkdirSync(".data", { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({
      status: "started",
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    }),
    { mode: 0o600 },
  );
  let usage: unknown;
  const capture: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    const data = await response.clone().json();
    usage = data.usageMetadata;
    return response;
  };
  try {
    const business = await draftQueries(
      interpret(
        "Our app estimates calories from food photos instead of manual ingredient logging.",
      ),
      process.env.GEMINI_API_KEY,
      capture,
    );
    const summary = {
      status: "passed",
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
      maxOutputTokens: 512,
      queries: business.queries,
      usage,
    };
    writeFileSync(path, JSON.stringify(summary, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(summary));
  } catch {
    writeFileSync(
      path,
      JSON.stringify({
        status: "failed",
        detail: "Model request or grounded output check failed; not retried.",
      }),
      { mode: 0o600 },
    );
    console.error("Model validation failed; no automatic retry.");
    process.exitCode = 1;
  }
}
main().catch(() => {
  console.error("Model validation could not start.");
  process.exitCode = 1;
});
