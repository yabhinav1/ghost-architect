import { Suspense } from "react";
import { loadBriefs } from "@/lib/explain";
import { analyzeRepo } from "@/lib/git";
import { scoreFiles } from "@/lib/score";

type Params = Promise<{ repo?: string; departed?: string }>;

// The report depends on the URL and on git, so it renders at request time inside a Suspense boundary.
export const instant = false;

export default function Report({ searchParams }: { searchParams: Params }) {
  return (
    <Suspense fallback={<main className="p-10 font-sans text-gray-500">Building report…</main>}>
      <ReportBody searchParams={searchParams} />
    </Suspense>
  );
}

async function ReportBody({ searchParams }: { searchParams: Params }) {
  const { repo, departed = "" } = await searchParams;
  if (!repo) return <main className="p-8 font-sans">Missing ?repo= parameter.</main>;
  const analysis = await analyzeRepo(repo);
  const departedSet = new Set(departed.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  const scored = scoreFiles(analysis.files, departedSet);
  const top = scored.filter((f) => f.score > 0).slice(0, 15);
  const briefs = await loadBriefs(repo, top.map((f) => f.path));
  const totalLines = scored.reduce((s, f) => s + f.lines, 0);
  const orphaned = scored.reduce((s, f) => s + f.departedLines, 0);
  const remainingAuthors = Object.entries(analysis.authors)
    .filter(([e]) => !departedSet.has(e))
    .sort((a, b) => b[1].lines - a[1].lines);
  let cum = 0;
  let busFactor = 0;
  const remaining = totalLines - orphaned;
  for (const [, a] of remainingAuthors) {
    cum += a.lines;
    busFactor++;
    if (cum >= remaining * 0.5) break;
  }

  return (
    <main className="mx-auto max-w-3xl bg-white p-10 font-sans text-black print:p-0">
      <h1 className="text-2xl font-semibold">Bus-factor report</h1>
      <p className="text-sm text-gray-600">{analysis.repoUrl} · analysed {analysis.analyzedAt.slice(0, 10)} · {analysis.analysedFiles} files</p>

      <section className="mt-6 grid grid-cols-3 gap-4 text-sm">
        <div className="rounded border p-3"><p className="text-gray-500">Departed engineers</p><p className="text-2xl font-semibold">{departedSet.size}</p></div>
        <div className="rounded border p-3"><p className="text-gray-500">Code last touched by them</p><p className="text-2xl font-semibold">{totalLines ? Math.round((orphaned / totalLines) * 100) : 0}%</p></div>
        <div className="rounded border p-3"><p className="text-gray-500">Remaining bus factor</p><p className="text-2xl font-semibold">{busFactor}</p><p className="text-xs text-gray-500">people covering half the remaining code</p></div>
      </section>

      <h2 className="mt-8 text-lg font-semibold">Files to assign an owner this week</h2>
      <table className="mt-2 w-full text-sm">
        <thead><tr className="border-b text-left text-gray-500"><th className="py-1">File</th><th>Score</th><th>Orphan share</th><th>Commits 12m</th><th>Importers</th></tr></thead>
        <tbody>
          {top.map((f) => (
            <tr key={f.path} className="border-b"><td className="py-1 font-mono text-xs">{f.path}</td><td>{f.score}</td><td>{Math.round(f.orphanShare * 100)}%</td><td>{f.commits12m}</td><td>{f.inbound}</td></tr>
          ))}
          {top.length === 0 && <tr><td colSpan={5} className="py-3 text-gray-500">No departed authors listed, so nothing is orphaned.</td></tr>}
        </tbody>
      </table>

      {briefs.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Why these files exist</h2>
          <p className="text-xs text-gray-500">Generated from commit and pull-request history. Claims marked documented cite evidence; inferred claims come from the code alone.</p>
          {briefs.map((b) => (
            <section key={b.file} className="mt-4 break-inside-avoid rounded border p-3 text-sm">
              <p className="font-mono text-xs text-gray-700">{b.file}</p>
              <p className="mt-1 text-gray-800">{b.brief.purpose}</p>
              {b.brief.claims.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-gray-700">
                  {b.brief.claims.map((c, i) => (
                    <li key={i}>
                      <span className={`mr-1 rounded px-1 text-[10px] ${c.status === "documented" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{c.status}</span>
                      {c.claim}
                      {c.evidence.length > 0 && <span className="ml-1 text-xs text-gray-500">[{c.evidence.join(", ")}]</span>}
                    </li>
                  ))}
                </ul>
              )}
              {b.brief.undocumented.length > 0 && (
                <p className="mt-2 text-xs text-gray-600"><span className="font-medium">Not documented:</span> {b.brief.undocumented.join(" · ")}</p>
              )}
            </section>
          ))}
        </>
      )}

      <h2 className="mt-8 text-lg font-semibold">How the score works</h2>
      <p className="mt-1 text-sm text-gray-700">
        Orphan share = 60% × (lines last touched by departed authors ÷ total lines) + 40% × (their share of commits in the last 24 months).
        Orphaned Criticality Score = orphan share × log(1 + commits in the last 12 months) × (1 + files that import this one), scaled so the riskiest file in the repo is 100.
        Blame shows who last edited a line, not who understood it, which is why commits are blended in. Treat the list as a starting point and confirm ownership with the team.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Recommended actions</h2>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-gray-700">
        <li>Assign a named maintainer to each file above and record it in a CODEOWNERS file.</li>
        <li>Run the &ldquo;why does this code exist&rdquo; brief on the top five and save the output next to the code.</li>
        <li>Add characterization tests around files with orphan share above 70% before the next change lands.</li>
      </ol>
      <p className="mt-8 text-xs text-gray-400 print:hidden">Use your browser&rsquo;s print dialog to save as PDF.</p>
    </main>
  );
}
