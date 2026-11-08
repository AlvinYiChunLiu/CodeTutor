/**
 * Prompt tuning: generate a lesson for each topic below and print a quality report.
 *   npm run lesson:tune              → all topics
 *   npm run lesson:tune -- while     → only topics whose name contains "while"
 * Lessons are saved to mocks/tuning/<name>.json (gitignored) so you can open any that look off.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import type { Lesson } from "../lib/schema";
import { generateLesson } from "../lib/ai/lesson";
import { isRecursive } from "../lib/ai/checker";
import { LessonRequest } from "../lib/ai/request";

try {
  process.loadEnvFile(".env.local");
} catch {}

const TOPICS: Record<string, unknown> = {
  "if-statement": { mode: "teach-concept", input: "What is an if statement?", language: "python" },
  "while-loop": { mode: "teach-concept", input: "Explain a while loop", language: "python" },
  "fibonacci": { mode: "teach-concept", input: "How does fibonacci recursion work?", language: "python" },
  "class": { mode: "teach-concept", input: "What is a class in Python?", language: "python" },
  "bubble-sort": {
    mode: "explain-code",
    input: "def bubble_sort(nums):\n    for i in range(len(nums)):\n        for j in range(len(nums) - 1 - i):\n            if nums[j] > nums[j + 1]:\n                nums[j], nums[j + 1] = nums[j + 1], nums[j]\n    return nums\n\nprint(bubble_sort([5, 2, 4, 1]))",
  },
  "js-async": {
    mode: "explain-code",
    input: "function wait(ms) {\n  return new Promise((resolve) => setTimeout(resolve, ms));\n}\n\nasync function main() {\n  console.log(\"start\");\n  await wait(1000);\n  console.log(\"done\");\n}\n\nmain();",
  },
};

type Row = { name: string; ok: boolean; secs: number; tries: number; scenes: number; code: number; arrays: number; stacks: number; notes: string[] };

/** Cheap automatic checks for things a judge would notice. */
function review(lesson: Lesson): string[] {
  const notes: string[] = [];
  const scenes = lesson.chapters.flatMap((c) => c.scenes);
  const code = scenes.find((s) => s.type === "code");
  const main = code?.type === "code" ? code.code : "";
  const lines = main.split("\n");
  if (lines.length > 14) notes.push(`code is ${lines.length} lines (video box fits ~12)`);
  const longest = Math.max(...lines.map((l) => l.length));
  if (longest > 60) notes.push(`longest code line is ${longest} chars`);
  const stacks = scenes.filter((s) => s.type === "diagram" && s.diagram.kind === "callstack").length;
  if (main && isRecursive(main) && stacks < 3) notes.push(`recursive code but only ${stacks} call-stack scene(s)`);
  if (!scenes.some((s) => s.type === "output")) notes.push("no output scene");
  for (const s of scenes) {
    const words = s.narration.split(/\s+/).length;
    if (words > 45) notes.push(`${s.id}: narration ${words} words`);
    if (/```|\*\*|`/.test(s.narration)) notes.push(`${s.id}: markdown in narration`);
    if (s.type === "code" && s.highlightLines.length === 0 && scenes.indexOf(s) > 1) notes.push(`${s.id}: code scene highlights nothing`);
  }
  const lineRefs = scenes.flatMap((s) => [...s.narration.matchAll(/\blines? (\d+)/gi)].map((m) => ({ s, n: Number(m[1]) })));
  for (const { s, n } of lineRefs) {
    if (s.type === "code" && !s.highlightLines.includes(n)) notes.push(`${s.id}: says "line ${n}" but highlights [${s.highlightLines}]`);
  }
  return notes;
}

const filter = process.argv[2];
const names = Object.keys(TOPICS).filter((n) => !filter || n.includes(filter));
mkdirSync("mocks/tuning", { recursive: true });
const rows: Row[] = [];

for (const name of names) {
  process.stdout.write(`▶ ${name} … `);
  const t = Date.now();
  let tries = 0;
  const rejected: string[] = [];
  try {
    const { lesson, meta } = await generateLesson(LessonRequest.parse(TOPICS[name]), (s) => {
      if (s.step === "writer") tries = s.attempt ?? 1;
      if (s.step === "checker" && s.issues) rejected.push(...s.issues.map((i) => `try ${s.attempt} rejected: ${i.slice(0, 140)}`));
    });
    writeFileSync(`mocks/tuning/${name}.json`, JSON.stringify(lesson, null, 2) + "\n");
    const scenes = lesson.chapters.flatMap((c) => c.scenes);
    const count = (k: string) => scenes.filter((s) => s.type === "diagram" && s.diagram.kind === k).length;
    rows.push({
      name, ok: true, secs: (Date.now() - t) / 1000, tries, scenes: scenes.length,
      code: scenes.filter((s) => s.type === "code").length, arrays: count("array"), stacks: count("callstack"),
      notes: [...review(lesson), ...meta.warnings.map((w) => `checker: ${w}`), ...rejected],
    });
    console.log(`✅ ${((Date.now() - t) / 1000).toFixed(0)}s`);
  } catch (e) {
    rows.push({ name, ok: false, secs: (Date.now() - t) / 1000, tries, scenes: 0, code: 0, arrays: 0, stacks: 0, notes: [(e as Error).message, ...rejected] });
    console.log("❌");
  }
}

console.log("\n topic          ok  time  tries scenes code array stack");
for (const r of rows) {
  console.log(` ${r.name.padEnd(14)} ${r.ok ? "✅" : "❌"} ${r.secs.toFixed(0).padStart(4)}s ${String(r.tries).padStart(5)} ${String(r.scenes).padStart(6)} ${String(r.code).padStart(4)} ${String(r.arrays).padStart(5)} ${String(r.stacks).padStart(5)}`);
}
console.log("\nThings to look at:");
for (const r of rows) for (const n of r.notes) console.log(` • ${r.name}: ${n}`);
if (rows.every((r) => !r.notes.length)) console.log(" (nothing flagged)");
console.log("\nLessons saved in mocks/tuning/ — paste this report to Claude.");
