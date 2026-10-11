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
}
export interface SourceItem {
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
  need: "Solution request" | "Alternative request";
  score: number;
  saved: boolean;
  irrelevant: boolean;
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
  | "results"
  | "retrieved"
  | "notice"
  | "error"
>;
export function publicScan(scan: Scan): PublicScan {
  return {
    id: scan.id,
    description: scan.description,
    mode: scan.mode,
    stage: scan.stage,
    business: scan.business,
    results: scan.results,
    retrieved: scan.retrieved,
    notice: scan.notice,
    error: scan.error,
  };
}
