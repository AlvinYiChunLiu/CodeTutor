import { z } from "zod";

const LANGS = ["python", "javascript", "typescript", "java", "c", "cpp"] as const;

/** Accept the frontend's labels ("Python", "C++", "JS") as well as the schema's ids. */
const LANG_ALIASES: Record<string, (typeof LANGS)[number] | "auto"> = {
  py: "python", js: "javascript", ts: "typescript", "c++": "cpp", auto: "auto", "": "auto",
};

/**
 * Mode names from every form in the app, mapped to the API's three modes.
 * "auto" = decide from the input: code → explain it, a question → teach the concept.
 */
const MODE_ALIASES: Record<string, "explain-code" | "explain-solution" | "teach-concept" | "auto"> = {
  "new-code": "teach-concept", // generate page: "Generate new code"
  "from-code": "explain-code", // generate page: "Explore my code"
  explainer: "auto", // home page InputForm
  walkthrough: "explain-solution",
  debugger: "explain-code",
  "explain-code": "explain-code",
  "explain-solution": "explain-solution",
  "teach-concept": "teach-concept",
};

/** Rough check: does this look like code rather than an English question? */
export function looksLikeCode(text: string): boolean {
  const t = text.trim();
  if (t.split("\n").length >= 2 && /[{}();=]|^\s*(def|class|for|while|if|function|const|let|import|public)\b/m.test(t)) return true;
  return /^\s*(def|class|function|const|let|import|public|#include)\b/.test(t) || /[;{}]\s*$/.test(t);
}

/** Accept other field names the forms use: `prompt` for `input`, `difficulty` for `level`. */
function normalizeBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const b = body as Record<string, unknown>;
  const level = typeof b.difficulty === "string" ? b.difficulty.toLowerCase() : undefined;
  return {
    ...b,
    input: b.input ?? b.prompt ?? b.code,
    level: b.level ?? (level === "advanced" ? "intermediate" : level),
  };
}

const LessonRequestObject = z.object({
  input: z
    .string()
    .trim()
    .min(1, "Paste some code or type a question.")
    .max(4000, "That's too long. Try under 4,000 characters."),
  mode: z
    .string()
    .default("explain-code")
    .transform((m) => MODE_ALIASES[m.trim().toLowerCase()])
    .pipe(z.enum(["explain-code", "explain-solution", "teach-concept", "auto"], { message: "Unknown mode." })),
  language: z
    .string()
    .default("auto")
    .transform((l) => {
      const k = l.trim().toLowerCase();
      return LANG_ALIASES[k] ?? k;
    })
    // Languages we can't name in the schema (Go, Rust…) fall back to auto-detect.
    .transform((l) => ((LANGS as readonly string[]).includes(l) ? l : "auto") as (typeof LANGS)[number] | "auto"),
  level: z.enum(["beginner", "intermediate"]).catch("beginner").default("beginner"),
  /** Set by the "Explain simpler" / "Go deeper" buttons. */
  adjust: z.enum(["simpler", "deeper"]).optional(),
});

/** What the input forms send to POST /api/lesson. */
export const LessonRequest = z.preprocess(
  normalizeBody,
  LessonRequestObject.transform((r) => ({
    ...r,
    mode: r.mode === "auto" ? (looksLikeCode(r.input) ? "explain-code" : "teach-concept") : r.mode,
  }) as Omit<typeof r, "mode"> & { mode: "explain-code" | "explain-solution" | "teach-concept" }),
);

export type LessonRequest = z.infer<typeof LessonRequest>;
export type CodeLanguage = Exclude<LessonRequest["language"], "auto">;
