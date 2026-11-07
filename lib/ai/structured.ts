/** One LLM call that must return JSON matching a zod schema; retries once with the errors. */
import type { z } from "zod";
import { chat, extractJson, type ChatMessage } from "./llm";
import { formatIssues } from "./checker";

export async function chatStructured<T extends z.ZodType>(
  schema: T,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; attempts?: number } = {},
): Promise<z.infer<T>> {
  const attempts = opts.attempts ?? 2;
  let issues: string[] = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const text = await chat({
      messages,
      temperature: attempt === 1 ? (opts.temperature ?? 0.4) : 0.2,
      maxTokens: opts.maxTokens ?? 1200,
      timeoutMs: 150_000,
    });
    try {
      const parsed = schema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      issues = formatIssues(parsed.error.issues);
    } catch (e) {
      issues = [(e as Error).message];
    }
    messages = [
      ...messages,
      { role: "assistant", content: text },
      { role: "user", content: `Problems:\n- ${issues.join("\n- ")}\nReply with the corrected JSON object only.` },
    ];
  }
  throw new StructuredOutputError(`Model reply failed the schema check: ${issues.join("; ")}`, issues);
}

export class StructuredOutputError extends Error {
  constructor(message: string, public issues: string[]) {
    super(message);
    this.name = "StructuredOutputError";
  }
}
