/**
 * Does "Explain simpler" / "Go deeper" actually change the lesson? Generates one topic three ways
 * and prints them side by side.
 *   npm run lesson:compare                                   → recursion
 *   npm run lesson:compare -- "Explain bubble sort" python   → any topic
 *   npm run lesson:compare -- --only simpler                  → just one variant
 * Lessons are saved to mocks/tuning/compare-<variant>.json (gitignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import type { Lesson } from "../lib/schema";
import { generateLesson } from "../lib/ai/lesson";
import { LessonRequest } from "../lib/ai/request";

try {
  process.loadEnvFile(".env.local");
} catch {}


mkdirSync("mocks/tuning", { recursive: true });

const ANALOGY = /\b(like a|imagine|think of|just like|similar to)\b/i;
const DEEP = /\b(complexity|O\(|edge case|memory|stack overflow|recursion limit|performance|under the hood|worst case|efficien)/i;

type Row = { variant: string; ok: boolean; secs: number; chapters: number; scenes: number; avgWords: number; analogies: number; deepTerms: number; title: string };
const rows: Row[] = [];

// --only simpler | --only deeper → run just that variant (plus nothing else)
const onlyIdx = process.argv.indexOf("--only");
const only = onlyIdx > 0 ? process.argv[onlyIdx + 1] : undefined;
if (onlyIdx > 0) process.argv.splice(onlyIdx, 2);
const variants = ([undefined, "simpler", "deeper"] as const).filter((a) => !only || (a ?? "normal") === only);
const input = process.argv[2] ?? "What is recursion?";
const language = process.argv[3] ?? "python";
for (const adjust of variants) {
  const variant = adjust ?? "normal";
  process.stdout.write(`▶ ${variant} … `);
  const t = Date.now();
  try {
    const { lesson } = await generateLesson(LessonRequest.parse({ input, language, mode: "teach-concept", adjust }));
    writeFileSync(`mocks/tuning/compare-${variant}.json`, JSON.stringify(lesson, null, 2) + "\n");
    const scenes = lesson.chapters.flatMap((c: Lesson["chapters"][number]) => c.scenes);
    const words = scenes.map((s) => s.narration.split(/\s+/).length);
    const text = scenes.map((s) => s.narration).join(" ");
    rows.push({
      variant, ok: true, secs: (Date.now() - t) / 1000, chapters: lesson.chapters.length, scenes: scenes.length,
      avgWords: Math.round(words.reduce((a, b) => a + b, 0) / words.length),
      analogies: scenes.filter((s) => ANALOGY.test(s.narration)).length,
      deepTerms: (text.match(new RegExp(DEEP.source, "gi")) ?? []).length,
      title: lesson.title,
    });
    console.log(`✅ ${((Date.now() - t) / 1000).toFixed(0)}s`);
  } catch (e) {
    rows.push({ variant, ok: false, secs: (Date.now() - t) / 1000, chapters: 0, scenes: 0, avgWords: 0, analogies: 0, deepTerms: 0, title: (e as Error).message });
    console.log("❌");
  }
}

console.log(`\nTopic: ${input}\n`);
console.log(" variant   ok  time  chapters scenes  words/scene  analogies  deep terms  title");
for (const r of rows) {
  console.log(` ${r.variant.padEnd(8)} ${r.ok ? "✅" : "❌"} ${r.secs.toFixed(0).padStart(4)}s ${String(r.chapters).padStart(9)} ${String(r.scenes).padStart(6)} ${String(r.avgWords).padStart(12)} ${String(r.analogies).padStart(10)} ${String(r.deepTerms).padStart(11)}  ${r.title}`);
}
const find = (v: string) => rows.find((r) => r.variant === v);
const [n, s, d] = [find("normal"), find("simpler"), find("deeper")];
console.log("\nWhat to expect:");
if (s) console.log(` • simpler: short narration, analogies → ${s.ok && s.avgWords <= 20 && (s.analogies >= 1 || (n?.ok && s.avgWords < n.avgWords)) ? "✅ looks simpler" : "⚠️ not clearly simpler"}`);
if (d) console.log(` • deeper: a "Going deeper" chapter, complexity / edge cases → ${d.ok && d.deepTerms >= 3 ? "✅ goes deeper" : "⚠️ not clearly deeper"}`);
for (const r of rows) if (!r.ok) console.log(` • ${r.variant} failed: ${r.title}`);
console.log("\nLessons saved to mocks/tuning/compare-*.json — paste this report to Claude.");
