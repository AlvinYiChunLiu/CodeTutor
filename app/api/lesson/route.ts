/**
 * POST /api/lesson
 * Body: { input, mode?, language?, level?, adjust? }  (see lib/ai/request.ts)
 * 200 → { lesson: Lesson, meta }   400 → { error, issues }   500/502 → { error, issues? }
 *
 * Add ?mock=1 (or set LLM_MOCK=1) to get the sample lesson instantly with no API call.
 */
import sample from "@/mocks/sample-lesson.json";
import { Lesson } from "@/lib/schema";
import { LessonRequest } from "@/lib/ai/request";
import { generateLesson, LessonGenerationError } from "@/lib/ai/lesson";
import { LLMError } from "@/lib/ai/llm";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = LessonRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const mock = new URL(req.url).searchParams.get("mock") === "1" || process.env.LLM_MOCK === "1";
  if (mock) {
    await new Promise((r) => setTimeout(r, 800)); // so the loading screen is visible
    return Response.json({ lesson: Lesson.parse(sample), meta: { model: "mock", totalMs: 800, steps: [], warnings: [] } });
  }

  try {
    const { lesson, meta } = await generateLesson(parsed.data, (s) =>
      console.log(`[lesson] ${s.step}#${s.attempt ?? 1} ${s.ms}ms${s.issues ? `\n  ✗ ${s.issues.join("\n  ✗ ")}` : ""}`),
    );
    if (meta.warnings.length) console.log(`[lesson] warnings: ${meta.warnings.join("; ")}`);
    return Response.json({ lesson, meta });
  } catch (e) {
    console.error("[lesson] failed:", e);
    if (e instanceof LessonGenerationError) {
      return Response.json({ error: e.message, issues: e.issues }, { status: 502 });
    }
    if (e instanceof LLMError) {
      return Response.json({ error: e.message }, { status: e.status === 500 || e.status === 401 ? 500 : 502 });
    }
    return Response.json({ error: "Something went wrong making the lesson." }, { status: 500 });
  }
}
