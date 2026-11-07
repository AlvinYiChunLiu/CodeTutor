/**
 * Tiny Featherless client (OpenAI-compatible chat completions).
 * Server-only: reads LLM_API_KEY from the environment.
 */

const BASE_URL = process.env.FEATHERLESS_BASE_URL ?? "https://api.featherless.ai/v1";
export const DEFAULT_MODEL = process.env.FEATHERLESS_MODEL ?? "Qwen/Qwen2.5-72B-Instruct";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatOptions = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export class LLMError extends Error {
  constructor(message: string, public status?: number, public raw?: string) {
    super(message);
    this.name = "LLMError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One chat completion. Retries once on 429 / 5xx / network errors. Returns the text. */
export async function chat(opts: ChatOptions): Promise<string> {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new LLMError("LLM_API_KEY is not set. Add your Featherless key to .env.local.", 500);

  const body = JSON.stringify({
    model: opts.model ?? DEFAULT_MODEL,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 3000,
  });

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/hackcamp/codetutor",
          "X-Title": "CodeTutor",
        },
        body,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
      });
      if (!res.ok) {
        const text = await res.text();
        const err = new LLMError(`Featherless ${res.status}: ${text.slice(0, 300)}`, res.status, text);
        // 429 = too many concurrent requests on the plan; 5xx = server hiccup. Worth one retry.
        if ((res.status === 429 || res.status >= 500) && attempt === 0) {
          lastErr = err;
          await sleep(res.status === 429 ? 3000 : 1000);
          continue;
        }
        throw err;
      }
      const data = await res.json();
      const content: unknown = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new LLMError("Featherless returned an empty message.", 502, JSON.stringify(data).slice(0, 500));
      }
      return content;
    } catch (e) {
      if (e instanceof LLMError && e.status && e.status < 500 && e.status !== 429) throw e;
      lastErr = e;
      if (attempt === 0) await sleep(1000);
    }
  }
  throw lastErr instanceof Error ? lastErr : new LLMError(String(lastErr));
}

/**
 * Pull a JSON object out of model text. Handles ```json fences, chatter before/after,
 * and trailing commas. Throws if nothing parseable is found.
 */
export function extractJson(text: string): unknown {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) throw new LLMError("No JSON object in model output.", 502, text);
  s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    try {
      return JSON.parse(escapeControlCharsInStrings(s).replace(/,\s*([}\]])/g, "$1"));
    } catch (e) {
      throw new LLMError(`Model output is not valid JSON: ${(e as Error).message}`, 502, text);
    }
  }
}

/** chat() + extractJson() in one go. */
export async function chatJson(opts: ChatOptions): Promise<unknown> {
  return extractJson(await chat(opts));
}

/** Models sometimes put raw newlines/tabs inside JSON strings. Escape them (only inside strings). */
function escapeControlCharsInStrings(s: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === "\\") {
        out += ch + (s[i + 1] ?? "");
        i++;
        continue;
      }
      if (ch === '"') inString = false;
      else if (ch === "\n") { out += "\\n"; continue; }
      else if (ch === "\r") { continue; }
      else if (ch === "\t") { out += "\\t"; continue; }
      else if (ch < " ") { continue; }
    } else if (ch === '"') {
      inString = true;
    }
    out += ch;
  }
  return out;
}
