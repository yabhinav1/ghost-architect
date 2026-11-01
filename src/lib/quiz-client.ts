import type { Handover } from "./types.ts";

/** Remove answers and explanations before a handover reaches the browser. */
export function stripQuiz<T extends Handover>(h: T) {
  if (!h.quiz) return h as Omit<T, "quiz"> & { quiz?: undefined };
  return { ...h, quiz: { ...h.quiz, questions: h.quiz.questions.map((q) => ({ id: q.id, file: q.file, question: q.question, choices: q.choices })) } };
}
