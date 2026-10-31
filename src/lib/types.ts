export type FileStat = {
  path: string;
  lines: number;
  /** author email -> lines they last touched (from git blame) */
  authors: Record<string, number>;
  /** author email -> commits touching this file in the last 24 months */
  commitAuthors: Record<string, number>;
  /** commits touching this file in the last 12 months */
  commits12m: number;
  /** commits touching this file in the last 24 months */
  commits24m: number;
  /** number of analysed files that import this one */
  inbound: number;
  /** ISO date, or "" when the last change is older than the 3-year history window */
  lastTouched: string;
  lastAuthor: string;
};

export type Analysis = {
  repoUrl: string;
  analyzedAt: string;
  totalFiles: number;
  analysedFiles: number;
  files: FileStat[];
  /** author email -> { name, lines, commits } across analysed files */
  authors: Record<string, { name: string; lines: number; commits: number }>;
};

export type Scored = FileStat & {
  departedLines: number;
  departedCommits: number;
  /** share of blame lines owned by departed authors */
  blameShare: number;
  /** share of 24-month commits by departed authors (falls back to blameShare when no commits) */
  commitShare: number;
  /** 0.6 * blameShare + 0.4 * commitShare */
  orphanShare: number;
  churn: number;
  loadBearing: number;
  raw: number;
  /** 0..100, relative to the riskiest file in the repo */
  score: number;
};

export type Evidence = {
  id: string;
  kind: "commit" | "pr";
  title: string;
  author: string;
  date: string;
  url: string;
  body: string;
};

export type Brief = {
  purpose: string;
  claims: { claim: string; evidence: string[]; status: "documented" | "inferred" }[];
  undocumented: string[];
  risks: string[];
  safeChangeChecklist: string[];
};

export type BriefResult = { brief: Brief; evidence: Evidence[]; model: string; file: string; generatedAt: string };

export type Progress = { step: string; done?: number; total?: number };
