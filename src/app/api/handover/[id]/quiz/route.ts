import { get, put } from "@/lib/db";
import { LlmError } from "@/lib/llm";
import { generateQuiz, grade } from "@/lib/quiz";
import { stripQuiz } from "@/lib/quiz-client";
import { audit, canManage, membership } from "@/lib/roles";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { getSession } from "@/lib/session";
import type { Handover } from "@/lib/types";

async function load(id: string) {
  const session = await getSession();
  if (!session) return { res: Response.json({ error: "Sign in first" }, { status: 401 }) };
  const h = await get<Handover>("handovers", id);
  if (!h) return { res: Response.json({ error: "Handover not found" }, { status: 404 }) };
  const me = session.login.toLowerCase();
  const m = await membership(h.orgId, me);
  const manager = Boolean(m && canManage(m.role));
  if (h.leaverLogin !== me && h.receiverLogin !== me && !manager) return { res: Response.json({ error: "Not your handover" }, { status: 403 }) };
  return { session, h, me, manager };
}

/** Generate (or regenerate) the knowledge check. Leaver or managers only. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await load(id);
  if ("res" in l) return l.res;
  if (l.me !== l.h.leaverLogin && !l.manager) return Response.json({ error: "The leaver or a manager generates the quiz; the receiver takes it" }, { status: 403 });
  const limit = rateLimit(_req, "llm", l.session.login);
  if (!limit.ok) return tooMany(limit, "quiz generation");
  try {
    const quiz = await generateQuiz(l.h, l.session.login);
    await put<Handover>("handovers", { ...l.h, quiz });
    await audit(l.h.orgId, l.session.login, "quiz.generate", l.h.id, { questions: quiz.questions.length });
    return Response.json({ quiz: stripQuiz({ ...l.h, quiz }).quiz }); // never send answers to the client
  } catch (e) {
    const status = e instanceof LlmError ? e.status : 400;
    return Response.json({ error: (e as Error).message }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}

/** Submit answers. Anyone on the handover may attempt; the receiver's best score counts for readiness. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await load(id);
  if ("res" in l) return l.res;
  if (!l.h.quiz) return Response.json({ error: "No quiz yet" }, { status: 400 });
  let body: { answers?: number[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const questions = l.h.quiz.questions;
  const answers = Array.isArray(body.answers) ? body.answers.map((n) => Number(n)) : [];
  if (answers.length !== questions.length || answers.some((a, i) => !Number.isInteger(a) || a < 0 || a >= questions[i].choices.length)) {
    return Response.json({ error: "Answer every question before submitting" }, { status: 400 });
  }
  // The receiver gets one scored attempt per generated quiz: the key must not be learnable by retrying.
  if (l.me === l.h.receiverLogin && l.h.quiz.attempts.some((a) => a.by === l.me)) {
    return Response.json({ error: "You have already taken this knowledge check. Ask the leaver to regenerate it for another attempt." }, { status: 409 });
  }
  const { score, total } = grade(l.h.quiz, answers);
  const attempt = { by: l.me, score, total, at: new Date().toISOString(), answers };
  const quiz = { ...l.h.quiz, attempts: [...l.h.quiz.attempts, attempt].slice(-20) };
  await put<Handover>("handovers", { ...l.h, quiz });
  await audit(l.h.orgId, l.session.login, "quiz.attempt", l.h.id, { score, total });
  // Correct answers are confirmed; wrong ones get the explanation but never the key.
  return Response.json({ score, total, review: questions.map((q, i) => ({ id: q.id, correct: answers[i] === q.answer, answer: answers[i] === q.answer ? q.answer : null, explanation: q.explanation })) });
}
