/**
 * POST /api/grade
 * Body: { practice: Practice, answer: string, language?: string, level?: "beginner" | "intermediate" }
 * 200 → { result: { verdict: "correct"|"almost"|"incorrect", score, feedback, line?, nextHint? } }
 * ?mock=1 (or LLM_MOCK=1) returns a canned "almost" result.
 */
import { gradeAnswer, GradeRequest } from "@/lib/ai/practice";
import { errorResponse, readJson } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await readJson(req);
  if (body instanceof Response) return body;

  const parsed = GradeRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request.", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  }

  const mock = new URL(req.url).searchParams.get("mock") === "1" || process.env.LLM_MOCK === "1";
  if (mock) {
    return Response.json({
      result: {
        verdict: "almost",
        score: 70,
        feedback: "Nice start: your recursive call shrinks the problem. But there's no base case, so it never stops.",
        line: 2,
        nextHint: "Add an if statement for the smallest input before the recursive call.",
      },
    });
  }

  try {
    return Response.json({ result: await gradeAnswer(parsed.data) });
  } catch (e) {
    return errorResponse("grade", e);
  }
}
