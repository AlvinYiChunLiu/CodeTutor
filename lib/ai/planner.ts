/** Step 1: Planner — turns the request into a chapter/beat outline (+ example code for concepts). */
import { z } from "zod";
import { chat, extractJson, type ChatMessage } from "./llm";
import { PLANNER_SYSTEM, plannerUser, SPOT_BUGS } from "./prompts";
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
  /** Pasted code only: one sentence naming the bug, or null when the code works. */
  bug: z
    .string()
    .nullish()
    .transform((b) => (b && b.trim() && !/^(none|null|no bugs?|n\/a)\.?$/i.test(b.trim()) ? b.trim() : null)),
  /** The learner's program with the smallest change that fixes the bug. */
  fixedCode: z.string().nullish(),
  chapters: z
    .array(z.object({ title: z.string().min(1), beats: z.array(z.string()).min(1) }))
    .min(1)
    .max(6),
});
export type Plan = Omit<z.infer<typeof Plan>, "fixedCode"> & {
  codeLanguage: CodeLanguage;
  mainCode: string;
  bug: string | null;
  fixedCode?: string;
};

/**
 * Pasted code arrives messy: Windows line endings, tabs, trailing spaces, and every line indented
 * because it was copied from inside something. Tidy it so the video shows clean code.
 */
export function tidyCode(code: string): string {
  const lines = code.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n").map((l) => l.replace(/\s+$/, ""));
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines.at(-1)) lines.pop();
  const indent = Math.min(...lines.filter(Boolean).map((l) => l.match(/^ */)![0].length));
  return lines.map((l) => l.slice(Number.isFinite(indent) ? indent : 0)).join("\n");
}

/** Languages that can be told apart from the code alone (the dropdown defaults to Python). */
function obviousLanguage(code: string): CodeLanguage | null {
  if (/\bpublic\s+(static\s+)?(class|void)\b|System\.out\.print/.test(code)) return "java";
  if (/#include\s*<(iostream|vector|string)>|\bstd::|\bcout\s*<</.test(code)) return "cpp";
  if (/#include\s*<stdio\.h>|\bprintf\s*\(/.test(code)) return "c";
  if (/console\.log|\b(const|let)\s+\w+\s*=|=>/.test(code)) return /:\s*(number|string|boolean)\b|\binterface\s/.test(code) ? "typescript" : "javascript";
  if (/^\s*def\s+\w+\(.*\)\s*:|\bprint\s*\(/m.test(code) && !/[;{}]\s*$/m.test(code)) return "python";
  return null;
}

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
        const mainCode = tidyCode((example ? parsed.data.mainCode : req.input) ?? "");
        // A bug only counts for the learner's own code, and only with a fix to show.
        const bug = example || !SPOT_BUGS ? null : parsed.data.bug;
        const fixedCode = bug && parsed.data.fixedCode ? tidyCode(parsed.data.fixedCode) : undefined;
        if (!mainCode) {
          issues = ['"mainCode" is missing. Write a short example program.'];
        } else if (bug && (!fixedCode || fixedCode === mainCode)) {
          issues = ['"bug" is set, so "fixedCode" must be the learner\'s full program with the bug fixed (the smallest change).'];
        } else {
          // When the dropdown was left on its default and the pasted code is clearly another language, trust the code.
          const codeLanguage = req.language === "auto" || (!example && parsed.data.codeLanguage !== req.language && obviousLanguage(mainCode) === parsed.data.codeLanguage)
            ? parsed.data.codeLanguage
            : req.language;
          return {
            plan: { ...parsed.data, codeLanguage, mainCode, bug, fixedCode },
            attempts: attempt,
          };
        }
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
