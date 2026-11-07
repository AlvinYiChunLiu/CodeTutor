import { z } from "zod";

/** What the input page sends to POST /api/lesson. */
export const LessonRequest = z.object({
  input: z
    .string()
    .trim()
    .min(1, "Paste some code or type a question.")
    .max(4000, "That's too long. Try under 4,000 characters."),
  mode: z.enum(["explain-code", "explain-solution", "teach-concept"]).default("explain-code"),
  language: z.enum(["auto", "python", "javascript", "typescript", "java", "c", "cpp"]).default("auto"),
  level: z.enum(["beginner", "intermediate"]).default("beginner"),
  /** Set by the "Explain simpler" / "Go deeper" buttons. */
  adjust: z.enum(["simpler", "deeper"]).optional(),
});

export type LessonRequest = z.infer<typeof LessonRequest>;
export type CodeLanguage = Exclude<LessonRequest["language"], "auto">;
