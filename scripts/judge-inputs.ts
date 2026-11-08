/**
 * npm run judge:test            → every case (about 10–15 minutes)
 * npm run judge:test -- buggy   → one case
 *
 * Inputs a judge might really type, sent exactly as the Generate page / home page send them.
 * Each case checks the lesson is about what was pasted (right output, right language, the bug is named).
 * A readable report goes to mocks/tuning/judge-<time>.md — send it to Ly / Claude to fix what broke.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { generateLesson } from "../lib/ai/lesson";
import { LessonRequest } from "../lib/ai/request";
import { currentModel } from "../lib/ai/llm";
import type { Lesson } from "../lib/schema";

try {
  process.loadEnvFile(".env.local");
} catch {}

type Case = {
  body: Record<string, string>; // what the page sends
  expect: {
    mode?: string;
    language?: string;
    output?: RegExp; // must appear in an output scene
    fixedOutput?: RegExp; // buggy code: the fixed program's output scene
    narration?: RegExp; // must appear somewhere in the narration
  };
};

const CASES: Record<string, Case> = {
  // Pasted from a web page: every line indented, Windows line endings, trailing spaces.
  "messy-paste": {
    body: {
      mode: "from-code",
      language: "Python",
      input: "    def average(nums):\r\n        total = 0   \r\n\r\n        for n in nums:\r\n            total += n\r\n        return total / len(nums)\r\n    \r\n    print(average([4, 8, 15, 16]))   \r\n",
    },
    expect: { mode: "explain-code", language: "python", output: /10\.75/ },
  },
  // Starts at 0, so a list of negative numbers prints 0 instead of -2.
  buggy: {
    body: {
      mode: "from-code",
      language: "Python",
      input: "def find_max(nums):\n    biggest = 0\n    for n in nums:\n        if n > biggest:\n            biggest = n\n    return biggest\n\nprint(find_max([-5, -2, -9]))",
    },
    // Bug spotting is off (SPOT_BUGS in lib/ai/prompts.ts), so only check the real output is told honestly.
    expect: { mode: "explain-code", output: /^\s*0\s*$/m },
  },
  // Home page box (mode is detected): a one-liner must be explained as code.
  "one-liner": {
    body: { mode: "explainer", language: "auto", input: "print(sum(range(5)))" },
    expect: { mode: "explain-code", language: "python", output: /^\s*10\s*$/m },
  },
  "js-one-liner": {
    body: { mode: "explainer", language: "auto", input: "console.log([1, 2, 3].map(x => x * 2))" },
    expect: { mode: "explain-code", language: "javascript", output: /2,\s*4,\s*6/ },
  },
  // Missing colon: the lesson should say it won't run, not invent output.
  "syntax-error": {
    body: { mode: "from-code", language: "Python", input: "for i in range(3)\n    print(i)" },
    expect: { mode: "explain-code", narration: /colon|syntax|error|won't run|will not run|doesn't run/i },
  },
  // Java pasted while the dropdown still says Python (its default).
  "wrong-dropdown": {
    body: {
      mode: "from-code",
      language: "Python",
      input: "public class Main {\n    public static void main(String[] args) {\n        int total = 0;\n        for (int i = 1; i <= 3; i++) {\n            total += i;\n        }\n        System.out.println(total);\n    }\n}",
    },
    expect: { mode: "explain-code", language: "java", output: /^\s*6\s*$/m },
  },
  vague: {
    body: { mode: "new-code", language: "Python", input: "explain loops" },
    expect: { mode: "teach-concept", language: "python" },
  },
  "very-vague": {
    body: { mode: "new-code", language: "Python", input: "help me with coding" },
    expect: { mode: "teach-concept" },
  },
  comparison: {
    body: { mode: "new-code", language: "Python", input: "difference between a list and a tuple" },
    expect: { mode: "teach-concept", language: "python", narration: /tuple/i },
  },
};

function check(c: Case, req: LessonRequest, lesson: Lesson): string[] {
  const problems: string[] = [];
  const scenes = lesson.chapters.flatMap((ch) => ch.scenes);
  const outputs = scenes.flatMap((s) => (s.type === "output" ? [s.output] : []));
  const narration = scenes.map((s) => s.narration).join(" ");
  if (c.expect.mode && req.mode !== c.expect.mode) problems.push(`treated as ${req.mode}, expected ${c.expect.mode}`);
  if (c.expect.language && lesson.codeLanguage !== c.expect.language) problems.push(`codeLanguage is ${lesson.codeLanguage}, expected ${c.expect.language}`);
  if (c.expect.output && !outputs.some((o) => c.expect.output!.test(o))) {
    problems.push(`no output scene matching ${c.expect.output} (got: ${outputs.map((o) => JSON.stringify(o)).join(", ") || "none"})`);
  }
  if (c.expect.fixedOutput && !(outputs.length >= 2 && c.expect.fixedOutput.test(outputs.at(-1)!))) {
    problems.push(`no fixed version: expected a second output scene matching ${c.expect.fixedOutput}`);
  }
  if (c.expect.narration && !c.expect.narration.test(narration)) problems.push(`narration never matches ${c.expect.narration}`);
  return problems;
}

function describe(lesson: Lesson): string {
  const lines = [`**${lesson.title}** (${lesson.codeLanguage}) — ${lesson.summary}`, ""];
  let codeShown = false;
  for (const ch of lesson.chapters) {
    lines.push(`- _${ch.title}_`);
    for (const s of ch.scenes) {
      let extra = "";
      if (s.type === "output") extra = ` → \`${s.output.replace(/\n/g, "⏎")}\``;
      if (s.type === "diagram") extra = ` [${s.diagram.kind}]`;
      if (s.type === "code") extra = ` [lines ${s.highlightLines.join(",") || "-"}]`;
      lines.push(`  - ${s.type}${extra}: ${s.narration}`);
      if (s.type === "code" && !codeShown) {
        lines.push("", "```", s.code, "```", "");
        codeShown = true;
      }
    }
  }
  return lines.join("\n");
}

const only = process.argv[2];
if (only && !CASES[only]) {
  console.error(`Unknown case "${only}". Try: ${Object.keys(CASES).join(", ")}`);
  process.exit(1);
}
const names = only ? [only] : Object.keys(CASES);
const report: string[] = [`# Judge-style inputs — ${new Date().toLocaleString()}`, `Model: ${currentModel()}`, ""];
const summary: string[] = [];
let failed = 0;

for (const name of names) {
  const c = CASES[name];
  console.log(`\n▶ ${name}  (model: ${currentModel()})`);
  report.push(`## ${name}`, "", "Input:", "```", c.body.input.replace(/\r/g, "␍"), "```", "");
  let req: LessonRequest;
  try {
    req = LessonRequest.parse(c.body);
  } catch (e) {
    failed++;
    summary.push(`❌ ${name}: request rejected (${(e as Error).message})`);
    report.push(`❌ Request rejected: ${(e as Error).message}`, "");
    continue;
  }
  const started = Date.now();
  try {
    const { lesson, meta } = await generateLesson(req, (s) =>
      console.log(`  ${s.step} #${s.attempt ?? 1}  ${(s.ms / 1000).toFixed(1)}s${s.issues ? `  ✗ ${s.issues.join(" | ")}` : ""}`),
    );
    const secs = ((Date.now() - started) / 1000).toFixed(0);
    const problems = check(c, req, lesson);
    if (problems.length) failed++;
    const line = `${problems.length ? "⚠️" : "✅"} ${name} (${secs}s, mode ${req.mode})${problems.length ? `: ${problems.join("; ")}` : ""}`;
    console.log(line);
    summary.push(line);
    report.push(line, "");
    if (meta.warnings.length) report.push(`Warnings: ${meta.warnings.join("; ")}`, "");
    report.push(describe(lesson), "");
  } catch (e) {
    failed++;
    const secs = ((Date.now() - started) / 1000).toFixed(0);
    const line = `❌ ${name} (${secs}s): ${(e as Error).message}`;
    console.log(line);
    summary.push(line);
    report.push(line, "", ...(((e as any).issues as string[] | undefined) ?? []).map((i) => `- ${i}`), "");
  }
}

mkdirSync("mocks/tuning", { recursive: true });
const file = `mocks/tuning/judge-${new Date().toISOString().replace(/[:.]/g, "-")}.md`;
writeFileSync(file, [report[0], report[1], "", "## Summary", "", ...summary, "", ...report.slice(2)].join("\n"));
console.log(`\n${summary.join("\n")}\n\nReport: ${file}`);
process.exit(failed ? 1 : 0);
