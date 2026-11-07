import { z } from "zod";

const LANGS = ["python", "javascript", "typescript", "java", "c", "cpp"] as const;

/** Accept the frontend's labels ("Python", "C++", "JS") as well as the schema's ids. */
const LANG_ALIASES: Record<string, (typeof LANGS)[number] | "auto"> = {
  py: "python", js: "javascript", ts: "typescript", "c++": "cpp", auto: "auto", "": "auto",
};

/** The generate page uses "new-code" / "from-code"; the API's own names work too. */
const MODE_ALIASES: Record<string, "explain-code" | "explain-solution" | "teach-concept"> = {
  "new-code": "teach-concept", // "Generate new code: describe what you're building"
  "from-code": "explain-code", // "Explore my code: upload a snippet"
  "explain-code": "explain-code",
  "explain-solution": "explain-solution",
  "teach-concept": "teach-concept",
};

/** What the input page sends to POST /api/lesson. */
export const LessonRequest = z.object({
  input: z
    .string()
    .trim()
    .min(1, "Paste some code or type a question.")
    .max(4000, "That's too long. Try under 4,000 characters."),
  mode: z
    .string()
    .default("explain-code")
    .transform((m) => MODE_ALIASES[m.trim().toLowerCase()])
    .pipe(z.enum(["explain-code", "explain-solution", "teach-concept"], { message: "Unknown mode." })),
  language: z
    .string()
    .default("auto")
    .transform((l) => {
      const k = l.trim().toLowerCase();
      return LANG_ALIASES[k] ?? k;
    })
    // Languages we can't name in the schema (Go, Rust…) fall back to auto-detect.
    .transform((l) => ((LANGS as readonly string[]).includes(l) ? l : "auto") as (typeof LANGS)[number] | "auto"),
  level: z.enum(["beginner", "intermediate"]).default("beginner"),
  /** Set by the "Explain simpler" / "Go deeper" buttons. */
  adjust: z.enum(["simpler", "deeper"]).optional(),
});

export type LessonRequest = z.infer<typeof LessonRequest>;
export type CodeLanguage = Exclude<LessonRequest["language"], "auto">;
