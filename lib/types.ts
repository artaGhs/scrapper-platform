export type Source = "reddit" | "x";
export const sourceNames: Record<Source, string> = { reddit: "Reddit", x: "X" };
export type SourceStatus =
  "queued" | "searching" | "complete" | "partial" | "failed";
export interface SourceRun {
  source: Source;
  status: SourceStatus;
  runId?: string;
  datasetId?: string;
  retrieved: number;
  normalized: number;
  actualUsd?: number;
  error?: string;
  queries?: string[];
  queryPlans?: Business["queryPlans"];
}
export function selectedSources(sources?: Source[]): Source[] {
  return sources?.length
    ? (["reddit", "x"].filter((source) =>
        sources.includes(source as Source),
      ) as Source[])
    : ["reddit"];
}
export type Mode = "sample" | "live";
export type Stage =
  | "interpreting"
  | "preparing"
  | "searching"
  | "reviewing"
  | "ranking"
  | "complete"
  | "empty"
  | "partial"
  | "failed";
export const terminalStages: Stage[] = [
  "complete",
  "empty",
  "partial",
  "failed",
];
export interface Business {
  category: string;
  summary: string;
  terms: string[];
  featureTerms: string[];
  queries: string[];
  queryMethod?: "Gemini draft";
  categoryPhrase?: string;
  communities?: string[];
  queryPlans?: {
    phrase: string;
    signal: "recommendation" | "problem" | "alternative";
    rationale: string;
  }[];
}
export interface SourceItem {
  source?: Source;
  id: string;
  title: string;
  text: string;
  url: string | null;
  community: string | null;
  publishedAt: string | null;
  synthetic: boolean;
}
export interface Opportunity extends SourceItem {
  reason: string;
  evidence: string;
  need: "Solution request" | "Alternative request" | "Problem context";
  score: number;
  saved: boolean;
  irrelevant: boolean;
  reviewMethod?: "Gemini assessment" | "Keyword rules";
}
export interface Scan {
  id: string;
  owner: string;
  key: string;
  description: string;
  mode: Mode;
  stage: Stage;
  createdAt: number;
  updatedAt: number;
  sources?: Source[];
  sourceRuns?: SourceRun[];
  sourceCursor?: number;
  xMonthlyRunLimit?: number;
  reviewComplete?: boolean;
  modelReview?: "Gemini + keyword rules" | "Keyword rules";
  business?: Business;
  runId?: string;
  datasetId?: string;
  items?: SourceItem[];
  results: Opportunity[];
  retrieved?: number;
  partial?: boolean;
  notice?: string;
  error?: string;
  reservedUsd: number;
  actualUsd?: number;
}
export type PublicScan = Pick<
  Scan,
  | "id"
  | "description"
  | "mode"
  | "stage"
  | "business"
  | "modelReview"
  | "sources"
  | "results"
  | "retrieved"
  | "notice"
  | "error"
> & { sourceRuns?: PublicSourceRun[] };
export type PublicSourceRun = Omit<
  SourceRun,
  "runId" | "datasetId" | "actualUsd"
>;
export function publicScan(
  scan: Scan,
): PublicScan & { sourceRuns: PublicSourceRun[] } {
  return {
    id: scan.id,
    description: scan.description,
    mode: scan.mode,
    stage: scan.stage,
    business: scan.business,
    modelReview: scan.modelReview,
    sources: selectedSources(scan.sources),
    sourceRuns: (scan.sourceRuns || []).map(
      ({
        source,
        status,
        retrieved,
        normalized,
        error,
        queries,
        queryPlans,
      }) => ({
        source,
        status,
        retrieved,
        normalized,
        error,
        queries,
        queryPlans,
      }),
    ),
    results: scan.results,
    retrieved: scan.retrieved,
    notice: scan.notice,
    error: scan.error,
  };
}
