"use client";

import { useState } from "react";
import type { Quiz, QuizAttempt } from "@/lib/types";

/** Quiz as the client sees it: answers and explanations are stripped on the server until an attempt is graded. */
export type ClientQuiz = Omit<Quiz, "questions"> & { questions: { id: string; file: string; question: string; choices: string[] }[] };
type Review = { id: string; correct: boolean; answer: number; explanation: string }[];

export const PASS_MARK = 0.8;

/**
 * Knowledge check. The leaver (or a manager) generates it from their notes and the file briefs;
 * the receiver answers; a pass needs 80%. Attempts are kept so a manager can see the receiver got there.
 */
export function KtQuiz({ handoverId, quiz: initial, mine, receiverLogin, meLogin }: { handoverId: string; quiz: ClientQuiz | null; mine: "leaver" | "receiver" | "manager"; receiverLogin: string; meLogin: string }) {
  const [quiz, setQuiz] = useState<ClientQuiz | null>(initial);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [review, setReview] = useState<Review | null>(null);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [busy, setBusy] = useState<"generate" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canGenerate = mine !== "receiver";
  const best = bestOf(quiz?.attempts ?? [], receiverLogin);
  const passed = Boolean(best && best.score / best.total >= PASS_MARK);
  const answered = quiz ? quiz.questions.filter((q) => answers[q.id] !== undefined).length : 0;

  async function generate() {
    setBusy("generate"); setError(null); setReview(null); setResult(null); setAnswers({});
    try {
      const r = await fetch(`/api/handover/${handoverId}/quiz`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setQuiz(d.quiz);
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  async function submit() {
    if (!quiz) return;
    setBusy("submit"); setError(null);
    try {
      const r = await fetch(`/api/handover/${handoverId}/quiz`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: quiz.questions.map((q) => answers[q.id] ?? -1) }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setReview(d.review); setResult({ score: d.score, total: d.total });
      setQuiz({ ...quiz, attempts: [...quiz.attempts, { by: meLogin, score: d.score, total: d.total, at: new Date().toISOString(), answers: quiz.questions.map((q) => answers[q.id] ?? -1) }] });
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  return (
    <div className="border-t border-border-muted">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-[12px]">
        <span className={`label ${passed ? "label-success" : best ? "label-attention" : quiz ? "label-accent" : "label-muted"}`}>
          {passed ? `passed ${best!.score}/${best!.total}` : best ? `best ${best.score}/${best.total}` : quiz ? `${quiz.questions.length} questions` : "no knowledge check"}
        </span>
        <span className="text-fg-muted">Knowledge check{quiz ? ` · generated ${quiz.generatedAt.slice(0, 10)} by @${quiz.generatedBy}` : ""}</span>
        <span className="flex-1" />
        {canGenerate && <button onClick={generate} disabled={busy !== null} className="btn btn-sm">{busy === "generate" ? <span className="ghost-pulse">Writing questions…</span> : quiz ? "Regenerate" : "Generate from notes and briefs"}</button>}
      </div>
      {error && <p className="px-4 pb-2 text-[12px] text-danger">{error}</p>}
      {!quiz && <p className="px-4 pb-3 text-[12px] text-fg-subtle">{canGenerate ? "Five multiple-choice questions written from the notes above and the file briefs. The receiver must score 80% before the handover reads as ready." : "The leaver has not generated a knowledge check yet."}</p>}
      {quiz && (
        <div className="px-4 pb-3">
          <ol className="space-y-3">
            {quiz.questions.map((q, i) => {
              const rv = review?.find((r) => r.id === q.id);
              return (
                <li key={q.id} className={`rounded-md border p-3 text-[13px] ${rv ? (rv.correct ? "border-success/50 bg-success-muted/40" : "border-danger/50 bg-danger-muted/40") : "border-border-muted"}`}>
                  <p className="flex items-start gap-2"><span className="font-mono text-[11px] text-fg-subtle">{i + 1}</span><span className="font-medium">{q.question}</span></p>
                  <p className="mt-0.5 pl-5 font-mono text-[11px] text-fg-subtle">{q.file}</p>
                  <div className="mt-2 grid gap-1 pl-5 sm:grid-cols-2">
                    {q.choices.map((c, ci) => {
                      const chosen = answers[q.id] === ci;
                      const isAnswer = rv && rv.answer === ci;
                      const cls = rv ? (isAnswer ? "border-success bg-success-muted text-fg" : chosen ? "border-danger text-fg-muted line-through" : "border-border-muted text-fg-subtle") : chosen ? "border-accent bg-accent-muted text-fg" : "border-border-muted hover:border-border hover:bg-canvas-subtle";
                      return (
                        <button key={ci} disabled={Boolean(review) || busy !== null} onClick={() => setAnswers((a) => ({ ...a, [q.id]: ci }))} className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-left text-[12px] ${cls}`}>
                          <span className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${chosen || isAnswer ? "border-current" : "border-border"}`}>{String.fromCharCode(65 + ci)}</span>
                          <span>{c}</span>
                        </button>
                      );
                    })}
                  </div>
                  {rv && <p className={`mt-2 pl-5 text-[12px] ${rv.correct ? "text-success" : "text-danger"}`}>{rv.correct ? "Correct." : "Not quite."} <span className="text-fg-muted">{rv.explanation}</span></p>}
                </li>
              );
            })}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {!review ? (
              <>
                <button onClick={submit} disabled={busy !== null || answered < quiz.questions.length} className="btn btn-sm btn-primary">{busy === "submit" ? "Grading…" : "Submit answers"}</button>
                <span className="text-[12px] text-fg-muted">{answered}/{quiz.questions.length} answered{mine !== "receiver" ? " · you can take it too, but only the receiver's score counts" : ""}</span>
              </>
            ) : (
              <>
                <span className={`label ${result && result.score / result.total >= PASS_MARK ? "label-success" : "label-attention"}`}>{result?.score}/{result?.total} · {result && result.score / result.total >= PASS_MARK ? "passed" : "below 80%, try again"}</span>
                <button onClick={() => { setReview(null); setResult(null); setAnswers({}); }} className="btn btn-sm">Retake</button>
              </>
            )}
            {quiz.attempts.length > 0 && <span className="ml-auto text-[11px] text-fg-subtle">{quiz.attempts.length} attempt{quiz.attempts.length === 1 ? "" : "s"} · best by @{receiverLogin}: {best ? `${best.score}/${best.total}` : "none yet"}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function bestOf(attempts: QuizAttempt[], login: string) {
  return attempts.filter((a) => a.by === login).reduce<QuizAttempt | null>((b, a) => (!b || a.score / a.total > b.score / b.total ? a : b), null);
}
