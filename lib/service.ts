import { AppError, liveConfig, SCAN_TIMEOUT_MS } from "./config";
import { interpret, normalize, rank } from "./discovery";
import { RedditProvider } from "./provider";
import { sampleItems } from "./samples";
import { ScanStore, store } from "./store";
import { terminalStages, type Scan } from "./types";

interface Provider {
  start: RedditProvider["start"];
  poll: RedditProvider["poll"];
  items: RedditProvider["items"];
  abort: RedditProvider["abort"];
}
export async function advance(
  id: string,
  owner: string,
  db: ScanStore = store(),
  injectedProvider?: Provider,
): Promise<Scan> {
  const current = db.get(id, owner);
  if (!current)
    throw new AppError("Search not found or expired. Start a new search.", 404);
  if (terminalStages.includes(current.stage)) return current;
  if (db.expiredLease(id, owner)) {
    // A crash during creation is ambiguous: fail closed rather than duplicate a paid run.
    current.stage = "failed";
    current.error =
      "This search was interrupted. An uncertain source job will not be restarted automatically.";
    db.save(current);
    return current;
  }
  if (!db.claim(id, owner)) return current;
  // Read after claiming, so a concurrent request cannot act on an earlier stage.
  const scan = db.get(id, owner)!;
  try {
    const provider =
      scan.mode === "live"
        ? injectedProvider ||
          (() => {
            const config = liveConfig();
            return new RedditProvider(config.token, scan.reservedUsd);
          })()
        : undefined;
    if (Date.now() - scan.createdAt > SCAN_TIMEOUT_MS) {
      if (provider && scan.runId) {
        try {
          await provider.abort(scan.runId);
        } catch {
          /* Provider has its own 180-second timeout. */
        }
      }
      throw new AppError(
        "The search reached its time limit. Start a new search when the source is available.",
        504,
      );
    }
    switch (scan.stage) {
      case "interpreting":
        scan.business = interpret(scan.description);
        scan.stage = "preparing";
        break;
      case "preparing": {
        if (provider) {
          const run = await provider.start(scan.business!);
          scan.runId = run.id;
          scan.datasetId = run.defaultDatasetId;
        }
        scan.stage = "searching";
        break;
      }
      case "searching": {
        if (!provider) {
          scan.items = sampleItems();
          scan.retrieved = scan.items.length;
          scan.stage = "reviewing";
          break;
        }
        const run = await provider.poll(scan.runId!);
        if (
          typeof run.usageTotalUsd === "number" &&
          Number.isFinite(run.usageTotalUsd)
        )
          scan.actualUsd = run.usageTotalUsd;
        if (
          ["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"].includes(run.status)
        ) {
          const raw = await provider.items(scan.datasetId!);
          scan.retrieved = raw.length;
          scan.items = normalize(raw);
          scan.partial = run.status !== "SUCCEEDED";
          if (scan.partial)
            scan.notice =
              "The source job ended before completing. These results use only the records actually returned.";
          scan.stage = "reviewing";
        } else if (
          !["READY", "RUNNING", "ABORTING", "TIMING-OUT"].includes(run.status)
        ) {
          throw new AppError(
            "The source returned an unrecognized job state. This search has stopped.",
            502,
          );
        }
        break;
      }
      case "reviewing":
        scan.stage = "ranking";
        break;
      case "ranking":
        scan.results = rank(scan.items || [], scan.business!);
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
    scan.error =
      error instanceof AppError
        ? error.message
        : "This search could not finish. Your description is preserved; try again.";
  }
  db.save(scan);
  return scan;
}
