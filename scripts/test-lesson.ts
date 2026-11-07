/**
 * Run the AI pipeline without Next.js:
 *   npm run lesson:test                 → all presets
 *   npm run lesson:test -- recursion    → one preset
 * Valid lessons are saved to mocks/demo/<preset>.json (handy for offline demo caching).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { generateLesson } from "../lib/ai/lesson";
import { LessonRequest } from "../lib/ai/request";

try {
  process.loadEnvFile(".env.local");
} catch {}

const PRESETS: Record<string, unknown> = {
  recursion: { mode: "teach-concept", input: "What is recursion?", language: "python" },
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
const names = only ? [only] : Object.keys(PRESETS);
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
