import {
  AppError,
  FREE_RESULT_LIMIT,
  liveConfig,
  MIN_PROVIDER_ITEMS,
  SCAN_TIMEOUT_MS,
} from "./config";
import { interpret, isDiscussionRecord, normalize, rank } from "./discovery";
import { assessCandidates } from "./model-review";
import type { draftQueries } from "./model";
import { RedditProvider } from "./provider";
import { XProvider, xSearchQuery } from "./x-provider";
import { sampleItems } from "./samples";
import { type ScanRepository, store } from "./store";
import {
  selectedSources,
  sourceNames,
  terminalStages,
  type Scan,
  type Source,
  type SourceRun,
} from "./types";

export interface Provider {
  start: RedditProvider["start"];
  poll: RedditProvider["poll"];
  items: RedditProvider["items"];
  abort: RedditProvider["abort"];
}
type Injected = Provider | Partial<Record<Source, Provider>>;
const stopped = (run: SourceRun) =>
  ["complete", "partial", "failed"].includes(run.status);
function sourceError(error: unknown): string {
  return error instanceof AppError
    ? error.message
    : "The source request could not finish. An uncertain job start will not be retried automatically.";
}
function finishRetrieval(scan: Scan) {
  const runs = scan.sourceRuns!;
  scan.retrieved = runs.reduce((sum, run) => sum + run.retrieved, 0);
  const knownCosts = runs.filter((run) => typeof run.actualUsd === "number");
  if (knownCosts.length)
    scan.actualUsd = knownCosts.reduce((sum, run) => sum + run.actualUsd!, 0);
  scan.partial = runs.some(
    (run) => run.status === "partial" || run.status === "failed",
  );
  if (runs.every((run) => run.status === "failed")) {
    scan.stage = "failed";
    scan.error = runs
      .map((run) => `${sourceNames[run.source]}: ${run.error}`)
      .join(" ");
  } else {
    scan.error = undefined;
    if (scan.partial)
      scan.notice =
        "Some source work could not finish. These results use only the records actually returned; missing sources are not confirmed empty searches.";
    scan.stage = "reviewing";
  }
}
export async function advance(
  id: string,
  owner: string,
  repository?: ScanRepository,
  injectedProvider?: Injected,
  injectedDraft?: typeof draftQueries,
  injectedAssessment?: typeof assessCandidates,
): Promise<Scan> {
  const db = repository || (await store());
  const current = await db.get(id, owner);
  if (!current)
    throw new AppError("Search not found or expired. Start a new search.", 404);
  if (terminalStages.includes(current.stage)) return current;
  if (await db.expiredLease(id, owner)) {
    current.stage = "failed";
    current.error =
      "This search was interrupted. An uncertain source job will not be restarted automatically.";
    for (const run of current.sourceRuns || [])
      if (!stopped(run)) {
        run.status = "failed";
        run.error = current.error;
      }
    if (current.sourceRuns?.length) finishRetrieval(current);
    if (current.free && !current.developer && !current.startAttempted)
      await db.releaseFree(current);
    await db.save(current);
    return current;
  }
  if (!(await db.claim(id, owner))) return current;
  const scan = (await db.get(id, owner))!;
  scan.sources = selectedSources(scan.sources);
  // Old durable Reddit scans retain their existing job; upgrading never creates a replacement job.
  scan.sourceRuns ??= scan.sources.map((source) => ({
    source,
    status: scan.runId ? "searching" : "queued",
    runId: scan.runId,
    datasetId: scan.datasetId,
    retrieved: 0,
    normalized: 0,
  }));
  const providerFor = (source: Source): Provider => {
    if (injectedProvider) {
      const provider =
        "start" in injectedProvider
          ? injectedProvider
          : injectedProvider[source];
      if (!provider)
        throw new AppError("This source is unavailable for this search.", 503);
      return provider;
    }
    const config = liveConfig(scan.sources);
    // The total reservation covers both jobs. X always uses one query and at most ten posts.
    const redditBudget =
      scan.sources!.includes("reddit") && scan.sources!.includes("x")
        ? Number((scan.reservedUsd - 0.02).toFixed(6))
        : scan.reservedUsd;
    const budget =
      source === "reddit"
        ? redditBudget
        : scan.sources!.includes("reddit")
          ? Number((scan.reservedUsd - redditBudget).toFixed(6))
          : scan.reservedUsd;
    return source === "reddit"
      ? new RedditProvider(
          config.token,
          budget,
          fetch,
          scan.free ? MIN_PROVIDER_ITEMS : scan.sources!.length === 2 ? 40 : 50,
        )
      : new XProvider(config.token, budget);
  };
  try {
    if (
      Date.now() - scan.createdAt > SCAN_TIMEOUT_MS &&
      ["interpreting", "preparing", "searching"].includes(scan.stage)
    ) {
      for (const run of scan.sourceRuns)
        if (!stopped(run)) {
          if (scan.mode === "live" && run.runId)
            try {
              await providerFor(run.source).abort(run.runId);
            } catch {
              /* Each actor has its own 180-second timeout. */
            }
          run.status = "failed";
          run.error =
            "The source reached its time limit; this does not confirm an empty search.";
        }
      finishRetrieval(scan);
      if (scan.free && !scan.developer && !scan.startAttempted)
        await db.releaseFree(scan);
    } else
      switch (scan.stage) {
        case "interpreting": {
          scan.business = interpret(scan.description);
          // Deterministic source syntax keeps category recall; Gemini assesses returned context.
          // The draft injection is retained only for legacy validation compatibility.
          if (
            injectedDraft &&
            scan.mode === "live" &&
            scan.sources.includes("reddit") &&
            process.env.GEMINI_API_KEY
          ) {
            try {
              scan.business = await injectedDraft(
                scan.business,
                process.env.GEMINI_API_KEY,
              );
            } catch {
              scan.notice =
                "The model could not draft grounded phrases. This search uses the keyword strategy instead.";
            }
          }
          for (const run of scan.sourceRuns) {
            if (run.source === "reddit")
              run.searchKinds =
                scan.mode === "live" ? ["post", "comment"] : ["post"];
            run.queryPlans =
              run.source === "reddit" ? scan.business.queryPlans : undefined;
            run.queries =
              run.source === "x"
                ? [xSearchQuery(scan.business)]
                : scan.business.queries;
          }
          scan.stage = "preparing";
          break;
        }
        case "preparing": {
          const run = scan.sourceRuns.find((run) => run.status === "queued");
          if (run) {
            if (scan.mode === "sample") run.status = "searching";
            else
              try {
                const provider = providerFor(run.source);
                if (scan.developer) {
                  scan.startAttempted = true;
                  await db.save(scan, false);
                } else if (scan.free) await db.consumeFree(scan);
                const started = await provider.start(scan.business!);
                run.runId = started.id;
                run.datasetId = started.defaultDatasetId;
                run.status = "searching";
                // Retain private legacy fields for existing validation tooling; publicScan excludes them.
                if (scan.sources.length === 1) {
                  scan.runId = started.id;
                  scan.datasetId = started.defaultDatasetId;
                }
              } catch (error) {
                if (
                  scan.free &&
                  !scan.developer &&
                  (!scan.startAttempted ||
                    (error instanceof AppError && error.noJobStarted))
                )
                  await db.releaseFree(scan);
                run.status = "failed";
                run.error = sourceError(error);
              }
          }
          if (!scan.sourceRuns.some((run) => run.status === "queued")) {
            scan.stage = "searching";
            if (scan.sourceRuns.every(stopped)) finishRetrieval(scan);
          }
          break;
        }
        case "searching": {
          if (scan.mode === "sample") {
            scan.items = sampleItems(scan.sources);
            for (const run of scan.sourceRuns) {
              if (run.source === "reddit") run.searchKinds = ["post"];
              run.status = "complete";
              run.retrieved = scan.items.filter(
                (item) => item.source === run.source,
              ).length;
              run.normalized = run.retrieved;
            }
            finishRetrieval(scan);
            break;
          }
          // Advance one source at a time under the durable lease, alternating while jobs run.
          const runs = scan.sourceRuns;
          const cursor = scan.sourceCursor || 0;
          const index = runs.findIndex(
            (_, i) => !stopped(runs[(i + cursor) % runs.length]),
          );
          const run =
            index < 0 ? undefined : runs[(index + cursor) % runs.length];
          if (run) {
            scan.sourceCursor =
              (((index + cursor) % runs.length) + 1) % runs.length;
            try {
              const provider = providerFor(run.source);
              const state = await provider.poll(run.runId!);
              if (
                typeof state.usageTotalUsd === "number" &&
                Number.isFinite(state.usageTotalUsd)
              )
                run.actualUsd = state.usageTotalUsd;
              if (
                ["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"].includes(
                  state.status,
                )
              ) {
                const raw = await provider.items(run.datasetId!);
                run.retrieved = raw.length;
                const items = normalize(raw, Date.now(), run.source);
                run.normalized = items.length;
                const usable = raw.filter((record) =>
                  isDiscussionRecord(record, run.source),
                ).length;
                if (!usable && (state.status !== "SUCCEEDED" || raw.length > 0))
                  throw new AppError(
                    "The source returned no usable discussion text and links. This is a source failure, not a confirmed empty search.",
                    502,
                  );
                scan.items = [...(scan.items || []), ...items];
                // A free run that delivered its whole ten-record batch and then
                // hit the explicit cost ceiling fulfilled bounded retrieval.
                // Timeouts, unexpected aborts and shorter batches stay partial.
                const completedFreeBatch =
                  scan.free &&
                  state.status === "ABORTED" &&
                  /reached its maximum cost|reached.*spending limit/i.test(
                    state.statusMessage || "",
                  ) &&
                  usable >= MIN_PROVIDER_ITEMS;
                run.status =
                  state.status === "SUCCEEDED" || completedFreeBatch
                    ? "complete"
                    : "partial";
                if (completedFreeBatch)
                  scan.notice =
                    "This free search reviewed its ten-record batch. It is a small sample, not an exhaustive Reddit search.";
                if (run.status === "partial")
                  run.error =
                    "The job stopped early. Only the records actually returned were reviewed.";
              } else if (
                !["READY", "RUNNING", "ABORTING", "TIMING-OUT"].includes(
                  state.status,
                )
              )
                throw new AppError(
                  "The source returned an unrecognized job state. This search has stopped.",
                  502,
                );
            } catch (error) {
              run.status = "failed";
              run.error = sourceError(error);
            }
          }
          // Record spending as soon as observed, including when another source is still running.
          scan.retrieved = runs.reduce((sum, run) => sum + run.retrieved, 0);
          const known = runs.filter((run) => typeof run.actualUsd === "number");
          if (known.length)
            scan.actualUsd = known.reduce(
              (sum, run) => sum + run.actualUsd!,
              0,
            );
          if (runs.every(stopped)) finishRetrieval(scan);
          break;
        }
        case "reviewing": {
          scan.results = rank(scan.items || [], scan.business!);
          scan.modelReview = "Keyword rules";
          if (
            scan.mode === "live" &&
            process.env.GEMINI_API_KEY &&
            scan.results.length &&
            (!injectedProvider || injectedAssessment)
          ) {
            try {
              scan.results = await (injectedAssessment || assessCandidates)(
                scan.business!,
                scan.results,
                process.env.GEMINI_API_KEY,
              );
              scan.modelReview = "Gemini + keyword rules";
            } catch {
              scan.notice = [
                scan.notice,
                "The additional relevance review was unavailable. These results were checked against your search terms.",
              ]
                .filter(Boolean)
                .join(" ");
            }
          }
          scan.reviewComplete = true;
          if (scan.free)
            scan.results = scan.results.slice(0, FREE_RESULT_LIMIT);
          scan.stage = "ranking";
          break;
        }
        case "ranking":
          if (!scan.reviewComplete)
            scan.results = rank(scan.items || [], scan.business!);
          if (scan.free)
            scan.results = scan.results.slice(0, FREE_RESULT_LIMIT);
          scan.items = undefined;
          scan.stage = scan.partial
            ? "partial"
            : scan.results.length
              ? "complete"
              : "empty";
          break;
      }
  } catch (error) {
    scan.stage = "failed";
    scan.error = sourceError(error);
  }
  await db.save(scan);
  return scan;
}
