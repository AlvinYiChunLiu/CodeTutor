/**
 * POST /api/practice
 * Body: { lesson: Lesson, avoid?: string[] }
 * 200 → { practice: { question, starterCode?, hint?, solution } }
 * ?mock=1 (or LLM_MOCK=1) returns the sample lesson's practice problem.
 */
import sample from "@/mocks/lesson-recursion.json";
import { makePractice, PracticeRequest } from "@/lib/ai/practice";
import { errorResponse, readJson, shouldMock } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await readJson(req);
  if (body instanceof Response) return body;

  const mock = shouldMock(req);
  if (mock) {
    return Response.json({
      practice: (sample as { practice?: unknown }).practice ?? {
        question: "Write a recursive function sum_to(n) that returns 1 + 2 + ... + n. sum_to(4) should return 10.",
        starterCode: "def sum_to(n):\n    pass",
        hint: "What should sum_to(1) return?",
        solution: "def sum_to(n):\n    if n <= 1:\n        return n\n    return n + sum_to(n - 1)",
      },
    });
  }

  const parsed = PracticeRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Send the lesson you got from /api/lesson.", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  }
  try {
    return Response.json({ practice: await makePractice(parsed.data) });
  } catch (e) {
    return errorResponse("practice", e);
  }
}
