/**
 * Small, dependency-free vector search over repository metadata: TF-IDF term vectors with
 * cosine similarity, plus a visibility classifier (public / private / fork / archived) so a
 * query like "private payment services" ranks and labels in one pass. Client-safe.
 */
import type { Repo } from "./types";

export type RepoDoc = { id: number; repo: Repo; terms: Map<string, number>; norm: number; classes: string[] };

const STOP = new Set(["the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "my", "our", "repo", "repos", "repository", "repositories", "show", "find", "all", "me", "is", "that", "this", "which"]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s\-._/]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function classify(r: Repo): string[] {
  const c: string[] = [r.private ? "private" : "public"];
  if (r.fork) c.push("fork");
  if (r.archived) c.push("archived");
  const months = (Date.now() - Date.parse(r.pushed_at)) / (30.44 * 86400000);
  c.push(months > 6 ? "stale" : "active");
  if (r.language) c.push(r.language.toLowerCase());
  return c;
}

export function buildIndex(repos: Repo[]): { docs: RepoDoc[]; idf: Map<string, number> } {
  const df = new Map<string, number>();
  const raw = repos.map((r, id) => {
    const classes = classify(r);
    const text = `${r.name} ${r.name.replace(/[-_]/g, " ")} ${r.description ?? ""} ${r.language ?? ""} ${classes.join(" ")} ${r.owner.login}`;
    const tf = new Map<string, number>();
    for (const t of tokenize(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    return { id, repo: r, tf, classes };
  });
  const n = Math.max(1, repos.length);
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log(1 + n / d));
  const docs: RepoDoc[] = raw.map(({ id, repo, tf, classes }) => {
    const terms = new Map<string, number>();
    let sq = 0;
    for (const [t, f] of tf) {
      const w = (1 + Math.log(f)) * (idf.get(t) ?? 0);
      terms.set(t, w);
      sq += w * w;
    }
    return { id, repo, terms, norm: Math.sqrt(sq) || 1, classes };
  });
  return { docs, idf };
}

export type Hit = { repo: Repo; score: number; matched: string[]; classes: string[] };

/** Query terms that name a class ("private", "fork", "stale", "python") act as filters as well as terms. */
export function search(index: { docs: RepoDoc[]; idf: Map<string, number> }, query: string, limit = 12): { hits: Hit[]; filters: string[] } {
  const qTerms = tokenize(query);
  const known = new Set(["public", "private", "fork", "archived", "stale", "active"]);
  const filters = qTerms.filter((t) => known.has(t));
  const q = new Map<string, number>();
  for (const t of qTerms) q.set(t, (q.get(t) ?? 0) + 1);
  let qn = 0;
  const qv = new Map<string, number>();
  for (const [t, f] of q) {
    const w = (1 + Math.log(f)) * (index.idf.get(t) ?? Math.log(2));
    qv.set(t, w);
    qn += w * w;
  }
  qn = Math.sqrt(qn) || 1;
  const hits: Hit[] = [];
  for (const d of index.docs) {
    if (filters.some((f) => !d.classes.includes(f))) continue;
    let dot = 0;
    const matched: string[] = [];
    for (const [t, w] of qv) {
      const dw = d.terms.get(t);
      if (dw) {
        dot += w * dw;
        matched.push(t);
      } else {
        // prefix match for partial words ("pay" -> "payments")
        for (const [dt, dwt] of d.terms) if (dt.startsWith(t) && t.length >= 3) { dot += 0.5 * w * dwt; matched.push(dt); break; }
      }
    }
    const score = dot / (qn * d.norm);
    if (score > 0 || (filters.length && qTerms.length === filters.length)) hits.push({ repo: d.repo, score, matched: [...new Set(matched)], classes: d.classes });
  }
  hits.sort((a, b) => b.score - a.score || b.repo.pushed_at.localeCompare(a.repo.pushed_at));
  return { hits: hits.slice(0, limit), filters };
}
