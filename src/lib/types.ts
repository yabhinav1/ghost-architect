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
  /** commits in the 3-year window, newest first, capped: d = YYYY-MM-DD, a = author email */
  timeline: { d: string; a: string }[];
};

export type DailyActivity = {
  /** UTC calendar date of the commit's author timestamp. */
  date: string;
  commits: number;
  /** Author email -> commits on this date. Commits are counted once, not once per file. */
  authors: Record<string, number>;
};

export type Analysis = {
  repoUrl: string;
  analyzedAt: string;
  /** true for a private GitHub repo, false for public, undefined when GitHub could not be asked or the host is not GitHub */
  private?: boolean;
  totalFiles: number;
  analysedFiles: number;
  files: FileStat[];
  /** author email -> { name, lines, commits } across analysed files */
  authors: Record<string, { name: string; lines: number; commits: number }>;
  /** most recent commits in the window, newest first, capped */
  commits?: CommitEntry[];
  /** Daily totals from the full history scan, independent of the detailed commit-list cap. */
  activity?: DailyActivity[];
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

export type Receiver = { email: string; name: string; lines: number; commits: number } | null;

export type HandoverItem = { file: Scored; receiver: Receiver };

export type AskResult = { answer: string; evidence: string[]; status: "documented" | "inferred" | "not_documented" };

export type SessionUser = { login: string; name: string; avatar: string };

export type Repo = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  html_url: string;
  default_branch: string;
  size: number;
};

export type RecentAnalysis = { repoUrl: string; slug: string; analyzedAt: string; analysedFiles: number; authors: number };

export type RepoState = {
  mode: "layoffs" | "notice";
  departed: string[];
  stillHere: string[];
  noticeEmail: string;
  lastDay: string;
  kt: string[];
  updatedAt: string;
};

export type RecentEntry = { repoUrl: string; at: string };

// ---- organisations, roles, notices, handovers ----

export type OrgRole = "owner" | "manager" | "member";
export type MemberStatus = "active" | "leaving" | "left";

export type Org = {
  id: string;
  slug: string;
  name: string;
  createdBy: string;
  createdAt: string;
  /** NDA / support-access switch: when true, platform admins may view this organisation's data. */
  supportAccess: boolean;
  supportAccessChangedAt?: string;
  supportAccessChangedBy?: string;
  githubOrg?: string;
};

export type Member = {
  id: string; // `${orgId}:${login}`
  orgId: string;
  login: string;
  name: string;
  avatar?: string;
  /** git author email used to match commits to this person */
  email?: string;
  role: OrgRole;
  status: MemberStatus;
  joinedAt: string;
  lastDay?: string;
};

export type Invite = {
  id: string; // token
  orgId: string;
  role: OrgRole;
  /** optional restriction: only this GitHub login may accept */
  login?: string;
  createdBy: string;
  createdAt: string;
  acceptedBy?: string;
  acceptedAt?: string;
};

export type OrgRepo = {
  id: string; // `${orgId}:${repoKey}`
  orgId: string;
  repoUrl: string;
  addedBy: string;
  addedAt: string;
};

export type NoticeType = "general" | "layoff" | "notice-period" | "kt-request" | "handover" | "warning";
export type NoticeStatus = "sent" | "read" | "acknowledged";

export type Notice = {
  id: string;
  orgId: string;
  toLogin: string;
  type: NoticeType;
  subject: string;
  body: string;
  status: NoticeStatus;
  createdBy: string;
  createdAt: string;
  readAt?: string;
  ackAt?: string;
  /** optional link to a handover this notice is about */
  handoverId?: string;
};

export type HandoverFile = { path: string; done: boolean; notes: string; links: string[]; doneAt?: string };

export type Handover = {
  id: string;
  orgId: string;
  repoUrl: string;
  leaverLogin: string;
  leaverEmail?: string;
  receiverLogin: string;
  files: HandoverFile[];
  dueDate?: string;
  status: "open" | "complete";
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  /** knowledge check the receiver takes, generated from briefs and the leaver's notes */
  quiz?: Quiz;
};

export type AuditEntry = {
  id: string;
  orgId: string | null; // null for platform-level admin actions
  actor: string;
  action: string;
  target?: string;
  at: string;
  meta?: Record<string, unknown>;
};

export type CommitEntry = { sha: string; date: string; email: string; name: string; subject: string; files: number };

export type WorkTransfer = {
  id: string;
  senderLogin: string;
  recipientEmail: string;
  recipientLogin?: string;
  orgId?: string;
  orgName?: string;
  title: string;
  notes: string;
  repoUrl: string;
  branch: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  createdAt: string;
  updatedAt: string;
  senderReadAt?: string;
  recipientReadAt?: string;
  githubAccess?: "invited" | "already-access";
};

export type InboxSummary = {
  notices: (Notice & { orgName: string; orgSlug: string })[];
  unread: number;
  items: { id: string; title: string; detail: string; href: string; unread: boolean; at: string }[];
  transfers: (WorkTransfer & { incoming: boolean })[];
  emailWarning?: string;
};

export type QuizQuestion = { id: string; file: string; question: string; choices: string[]; answer: number; explanation: string };
export type QuizAttempt = { by: string; score: number; total: number; at: string; answers: number[] };
export type Quiz = { questions: QuizQuestion[]; generatedAt: string; generatedBy: string; attempts: QuizAttempt[] };
