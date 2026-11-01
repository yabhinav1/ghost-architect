import { handoversFor } from "@/lib/org";
import { stripQuiz } from "@/lib/quiz-client";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });
  return Response.json({ handovers: (await handoversFor(session.login)).map(stripQuiz) });
}
