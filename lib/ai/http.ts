/** Small helpers shared by the AI API routes. */
import { LLMError } from "./llm";
import { StructuredOutputError } from "./structured";

export async function readJson(req: Request): Promise<unknown | Response> {
  try {
    return await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
}

export function errorResponse(route: string, e: unknown): Response {
  console.error(`[${route}] failed:`, e);
  if (e instanceof StructuredOutputError) return Response.json({ error: "The AI gave a broken answer. Try again.", issues: e.issues }, { status: 502 });
  if (e instanceof LLMError) {
    return Response.json({ error: e.message }, { status: e.status === 500 || e.status === 401 ? 500 : 502 });
  }
  return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
}
