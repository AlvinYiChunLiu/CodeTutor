/**
 * Run the AI pipeline without Next.js:
 *   npm run lesson:test                 → all presets
 *   npm run lesson:test -- recursion    → one preset
 *   npm run lesson:test -- "What is an if statement?"   → any topic (or paste code)
 * Valid lessons are saved to mocks/demo/<name>.json (handy for offline demo caching).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { generateLesson } from "../lib/ai/lesson";
import { LessonRequest, looksLikeCode } from "../lib/ai/request";

try {
  process.loadEnvFile(".env.local");
} catch {}

const PRESETS: Record<string, unknown> = {
  recursion: { mode: "teach-concept", input: "What is recursion?", language: "python" },
  "binary-search": {
    mode: "teach-concept",
    input: "Teach binary search on a sorted array. Show how low, high, and mid move while searching for a target.",
    language: "python",
  },
  factorial: {
    mode: "teach-concept",
    input: "Teach recursive factorial using factorial(4), showing the recursive calls and how the call stack returns values.",
    language: "python",
  },
  "two-pointers": {
    mode: "teach-concept",
    input: "Teach the two-pointer technique by finding a pair that sums to a target in a sorted array. Show how the pointers move.",
    language: "python",
  },
  "two-sum": {
    mode: "explain-solution",
    input:
      "def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n\nprint(two_sum([2, 7, 11, 15], 9))",
  },
  "js-filter": {
    mode: "explain-code",
    input: "const nums = [3, 8, 1, 10, 6];\nconst big = nums.filter((n) => n > 5);\nconsole.log(big);",
  },
};

const only = process.argv[2];
// Anything that isn't a preset name is treated as a custom topic or code snippet.
if (only && !PRESETS[only]) {
  const slug = only.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "custom";
  PRESETS[slug] = { input: only, mode: looksLikeCode(only) ? "explain-code" : "teach-concept", language: process.argv[3] ?? "auto" };
  process.argv[2] = slug;
}
const names = process.argv[2] ? [process.argv[2]] : Object.keys(PRESETS);
mkdirSync("mocks/demo", { recursive: true });

let failed = 0;
for (const name of names) {
  const preset = PRESETS[name];
  if (!preset) {
    console.error(`Unknown preset "${name}". Try: ${Object.keys(PRESETS).join(", ")}`);
    process.exit(1);
  }
  console.log(`\n▶ ${name}`);
  try {
    const { lesson, meta } = await generateLesson(LessonRequest.parse(preset), (s) =>
      console.log(`  ${s.step} #${s.attempt ?? 1}  ${(s.ms / 1000).toFixed(1)}s${s.issues ? `  ✗ ${s.issues.join(" | ")}` : ""}`),
    );
    const scenes = lesson.chapters.reduce((n, c) => n + c.scenes.length, 0);
    writeFileSync(`mocks/demo/${name}.json`, JSON.stringify(lesson, null, 2) + "\n");
    console.log(`✅ "${lesson.title}" — ${lesson.chapters.length} chapters, ${scenes} scenes, ${(meta.totalMs / 1000).toFixed(1)}s → mocks/demo/${name}.json`);
    if (meta.warnings.length) console.log(`  warnings: ${meta.warnings.join("; ")}`);
  } catch (e) {
    failed++;
    console.error(`❌ ${(e as Error).message}`);
    if ((e as any).issues) console.error("  " + (e as any).issues.join("\n  "));
  }
}
process.exit(failed ? 1 : 0);
