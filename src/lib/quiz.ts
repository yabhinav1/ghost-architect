import { z } from "zod";
import { loadBriefs } from "./explain.ts";
import { chatJson, extractJson } from "./llm.ts";
import { newId } from "./db.ts";
import type { Handover, Quiz, QuizQuestion } from "./types.ts";

const Schema = z.object({
  questions: z.array(z.object({
    file: z.string(),
    question: z.string(),
    choices: z.array(z.string()).min(3).max(4),
    answer: z.number().int().min(0).max(3),
    explanation: z.string().default(""),
  })).min(3).max(8),
});

const SYSTEM = `You write short knowledge-transfer checks for an engineer inheriting code. Use ONLY the notes and briefs provided; never invent facts. Each question tests something a newcomer must know before changing the file: why it exists, a gotcha, what depends on it, who to ask. Multiple choice, one correct answer, plausible distractors, a one-sentence explanation. Respond with ONLY JSON: {"questions":[{"file":"path","question":"...","choices":["a","b","c","d"],"answer":0,"explanation":"..."}]}`;

/** Build a quiz from the handover's notes and any cached briefs for its files. */
export async function generateQuiz(h: Handover, by: string): Promise<Quiz> {
  const briefs = await loadBriefs(h.repoUrl, h.files.map((f) => f.path));
  const material = h.files
    .map((f) => {
      const b = briefs.find((x) => x.file === f.path);
      const parts = [`FILE: ${f.path}`];
      if (f.notes.trim()) parts.push(`LEAVER'S NOTES: ${f.notes.trim().slice(0, 600)}`);
      if (b) {
        parts.push(`BRIEF: ${b.brief.purpose.slice(0, 400)}`);
        if (b.brief.claims.length) parts.push(`CLAIMS: ${b.brief.claims.slice(0, 4).map((c) => c.claim).join(" | ").slice(0, 600)}`);
        if (b.brief.risks.length) parts.push(`RISKS: ${b.brief.risks.slice(0, 3).join(" | ").slice(0, 300)}`);
      }
      return parts.length > 1 ? parts.join("\n") : null;
    })
    .filter(Boolean)
    .slice(0, 8)
    .join("\n\n");
  if (!material) throw new Error("Nothing to quiz on yet: add notes to the files or generate briefs first.");
  const { text } = await chatJson([{ role: "system", content: SYSTEM }, { role: "user", content: `Repository: ${h.repoUrl}\n\n${material}\n\nWrite 5 questions.` }], { maxTokens: 2500 });
  const parsed = Schema.safeParse(extractJson(text));
  if (!parsed.success) throw new Error("The model returned an unusable quiz; try again.");
  const questions: QuizQuestion[] = parsed.data.questions.map((q) => ({ id: newId("q_"), file: q.file, question: q.question.slice(0, 300), choices: q.choices.map((c) => c.slice(0, 200)), answer: Math.min(q.answer, q.choices.length - 1), explanation: q.explanation.slice(0, 300) }));
  return { questions, generatedAt: new Date().toISOString(), generatedBy: by, attempts: [] };
}

export function grade(quiz: Quiz, answers: number[]): { score: number; total: number } {
  const total = quiz.questions.length;
  const score = quiz.questions.filter((q, i) => answers[i] === q.answer).length;
  return { score, total };
}
