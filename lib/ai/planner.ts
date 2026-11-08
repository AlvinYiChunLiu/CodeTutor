/** Step 1: Planner — turns the request into a chapter/beat outline (+ example code for concepts). */
import { z } from "zod";
import { chat, extractJson, type ChatMessage } from "./llm";
import { PLANNER_SYSTEM, plannerUser } from "./prompts";
import type { CodeLanguage, LessonRequest } from "./request";
import { formatIssues } from "./checker";

const LANGS = ["python", "javascript", "typescript", "java", "c", "cpp"] as const;

export const Plan = z.object({
  title: z.string().min(1).max(80),
  summary: z.string().min(1),
  codeLanguage: z
    .string()
    .transform((s) => s.toLowerCase().replace("js", "javascript").replace("ts", "typescript").replace("py", "python"))
    .pipe(z.enum(LANGS))
    .catch("python"),
  mainCode: z.string().optional(),
  chapters: z
    .array(z.object({ title: z.string().min(1), beats: z.array(z.string()).min(1) }))
    .min(1)
    .max(6),
});
export type Plan = z.infer<typeof Plan> & { codeLanguage: CodeLanguage; mainCode: string };

/** Concept questions have no code to explain, so the planner writes an example. */
export function needsExample(req: LessonRequest): boolean {
  return req.mode === "teach-concept";
}

export async function planLesson(req: LessonRequest): Promise<{ plan: Plan; attempts: number }> {
  const example = needsExample(req);
  const messages: ChatMessage[] = [
    { role: "system", content: PLANNER_SYSTEM },
    { role: "user", content: plannerUser(req, example) },
  ];

  let lastIssues: string[] = [];
  let lastText = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const text = await chat({ messages, temperature: attempt === 1 ? 0.4 : 0.2, maxTokens: 1500 });
    lastText = text;
    let issues: string[];
    try {
      const parsed = Plan.safeParse(extractJson(text));
      if (parsed.success) {
        const mainCode = (example ? parsed.data.mainCode : req.input)?.replace(/\s+$/, "") ?? "";
        if (mainCode) {
          return {
            plan: {
              ...parsed.data,
              codeLanguage: req.language === "auto" ? parsed.data.codeLanguage : req.language,
              mainCode,
            },
            attempts: attempt,
          };
        }
        issues = ['"mainCode" is missing. Write a short example program.'];
      } else {
        issues = formatIssues(parsed.error.issues);
      }
    } catch (e) {
      issues = [(e as Error).message];
    }
    lastIssues = issues;
    messages.push({ role: "assistant", content: text });
    messages.push({ role: "user", content: `Problems:\n- ${issues.join("\n- ")}\nReply with the corrected JSON only.` });
  }
  const said = lastText.replace(/\s+/g, " ").trim().slice(0, 160);
  throw new Error(`Planner failed: ${lastIssues.join("; ")}${said ? ` (model said: "${said}…")` : " (model sent an empty reply)"}`);
}
