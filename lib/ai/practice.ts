/** Practice problems and grading, built on the lesson the learner just watched. */
import { z } from "zod";
import { Lesson, Practice } from "../schema";
import { chatStructured } from "./structured";

// ---------------------------------------------------------------- shared

/** The bits of a lesson the model needs (not the whole JSON — saves tokens). */
function lessonBrief(lesson: Lesson): string {
  const scenes = lesson.chapters.flatMap((c) => c.scenes);
  const code = scenes.find((s) => s.type === "code")?.code ?? "";
  const recap = scenes.find((s) => s.type === "recap");
  return [
    `Lesson: ${lesson.title}`,
    `Summary: ${lesson.summary}`,
    `Level: ${lesson.level}`,
    `Language: ${lesson.codeLanguage}`,
    recap?.type === "recap" ? `Key points: ${recap.points.join("; ")}` : "",
    code ? `Code from the lesson:\n${code}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------- /api/practice

export const PracticeRequest = z.object({
  lesson: Lesson,
  /** Ask for a different problem than these questions (for a "New problem" button). */
  avoid: z.array(z.string()).max(10).default([]),
});
export type PracticeRequest = z.infer<typeof PracticeRequest>;

const PRACTICE_SYSTEM = `You write one practice problem for a learner who just watched a short coding lesson.
Reply with ONE JSON object and nothing else.`;

export async function makePractice(req: PracticeRequest): Promise<Practice> {
  const { lesson } = req;
  return chatStructured(Practice, [
    { role: "system", content: PRACTICE_SYSTEM },
    {
      role: "user",
      content: `${lessonBrief(lesson)}

Write ONE small ${lesson.codeLanguage} exercise that practices exactly the idea from this lesson, at ${lesson.level} level.
- Solvable in 3–12 lines. Similar to the lesson's example, but not the same function.
- The question names the function to write and gives one example call with its expected result.
${req.avoid.length ? `- Must be different from these earlier questions:\n${req.avoid.map((q) => `  * ${q}`).join("\n")}\n` : ""}
Reply with:
{
  "question": "1–3 sentences, plain text",
  "starterCode": "function signature with a placeholder body (pass / // your code here)",
  "hint": "one nudge that does not give the answer away",
  "solution": "a correct, complete solution"
}`,
    },
  ], { temperature: 0.6, maxTokens: 900 });
}

// ---------------------------------------------------------------- /api/grade

export const GradeRequest = z.object({
  practice: Practice,
  answer: z.string().trim().min(1, "Write some code first.").max(4000, "That's too long. Try under 4,000 characters."),
  language: z.string().default("python"),
  level: z.enum(["beginner", "intermediate"]).default("beginner"),
});
export type GradeRequest = z.infer<typeof GradeRequest>;

export const GradeResult = z.object({
  verdict: z.enum(["correct", "almost", "incorrect"]),
  /** 0–100, for a progress bar. */
  score: z.coerce.number().min(0).max(100).transform(Math.round),
  /** 1–3 friendly sentences shown to the learner. */
  feedback: z.string().min(1).max(600),
  /** 1-based line in the learner's answer to point at, if there's one clear problem. */
  line: z.coerce.number().int().min(1).optional().catch(undefined),
  /** A next step that doesn't give the answer away. Empty when correct. */
  nextHint: z.string().max(300).optional().catch(undefined),
});
export type GradeResult = z.infer<typeof GradeResult>;

const GRADE_SYSTEM = `You are a kind, precise programming tutor grading a learner's answer to a practice problem.
Mentally run their code on the example and on one edge case. Judge whether it solves the problem; style and
naming differences from the reference solution do NOT matter. Never paste the full solution into feedback.
Reply with ONE JSON object and nothing else.`;

export async function gradeAnswer(req: GradeRequest): Promise<GradeResult> {
  const numbered = req.answer
    .split("\n")
    .map((l, i) => `${String(i + 1).padStart(2, " ")}| ${l}`)
    .join("\n");
  const result = await chatStructured(GradeResult, [
    { role: "system", content: GRADE_SYSTEM },
    {
      role: "user",
      content: `Problem (${req.language}, ${req.level}):
${req.practice.question}

Reference solution (for you only):
${req.practice.solution}

Learner's answer (line numbers for you only):
${numbered}

Reply with:
{
  "verdict": "correct" | "almost" | "incorrect",
  "score": 0-100,
  "feedback": "1–3 encouraging sentences: what works, and the main problem if any",
  "line": number of the line with the main problem (omit if correct),
  "nextHint": "one small next step, without giving the answer (omit if correct)"
}
Scoring:
- "correct" (90–100): gives the right result for the example and normal inputs.
- "almost" (50–80): right idea and right result for the example, but a small bug on an edge input (off-by-one, n = 0, empty list).
- "incorrect" (0–45): wrong or no result for the example itself (e.g. prints/returns nothing, infinite recursion), even if the structure looks close.`,
    },
  ], { temperature: 0.1, maxTokens: 500 });

  // Keep the shape consistent for the UI.
  if (result.verdict === "correct") return { ...result, line: undefined, nextHint: undefined, score: Math.max(result.score, 90) };
  return result;
}
