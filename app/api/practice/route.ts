/**
 * POST /api/practice
 * Body: { lesson: Lesson, avoid?: string[] }
 * 200 → { practice: { question, starterCode?, hint?, solution } }
 * ?mock=1 (or LLM_MOCK=1) returns the sample lesson's practice problem.
 */
import { makePractice, PracticeRequest } from "@/lib/ai/practice";
import { errorResponse, readJson, shouldMock } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await readJson(req);
  if (body instanceof Response) return body;

  const parsed = PracticeRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Send the lesson you got from /api/lesson.", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  }

  if (shouldMock(req)) {
    const language = parsed.data.language ?? parsed.data.lesson.codeLanguage;
    const implementations = {
      python: {
        name: "sum_to",
        starter: "def sum_to(n):\n    pass",
        solution: "def sum_to(n):\n    if n <= 1:\n        return n\n    return n + sum_to(n - 1)",
      },
      javascript: {
        name: "sumTo",
        starter: "function sumTo(n) {\n  // Your code here\n}",
        solution: "function sumTo(n) {\n  if (n <= 1) return n;\n  return n + sumTo(n - 1);\n}",
      },
      typescript: {
        name: "sumTo",
        starter: "function sumTo(n: number): number {\n  // Your code here\n}",
        solution: "function sumTo(n: number): number {\n  if (n <= 1) return n;\n  return n + sumTo(n - 1);\n}",
      },
      java: {
        name: "sumTo",
        starter: "static int sumTo(int n) {\n    // Your code here\n}",
        solution: "static int sumTo(int n) {\n    if (n <= 1) return n;\n    return n + sumTo(n - 1);\n}",
      },
      c: {
        name: "sum_to",
        starter: "int sum_to(int n) {\n    // Your code here\n}",
        solution: "int sum_to(int n) {\n    if (n <= 1) return n;\n    return n + sum_to(n - 1);\n}",
      },
      cpp: {
        name: "sum_to",
        starter: "int sum_to(int n) {\n    // Your code here\n}",
        solution: "int sum_to(int n) {\n    if (n <= 1) return n;\n    return n + sum_to(n - 1);\n}",
      },
    } satisfies Record<(typeof parsed.data.lesson)["codeLanguage"], { name: string; starter: string; solution: string }>;
    const exercise = implementations[language];
    return Response.json({
      practice: {
        question: `Write a recursive function ${exercise.name}(n) that returns 1 + 2 + ... + n. ${exercise.name}(4) should return 10.`,
        starterCode: exercise.starter,
        hint: "What should the function return for the smallest input, before making another recursive call?",
        solution: exercise.solution,
      },
    });
  }

  try {
    return Response.json({ practice: await makePractice(parsed.data) });
  } catch (e) {
    return errorResponse("practice", e);
  }
}
