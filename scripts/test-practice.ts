/**
 * Practice + grading against a saved lesson:
 *   npm run practice:test                      → uses mocks/demo/recursion.json
 *   npm run practice:test -- mocks/demo/two-sum.json
 * Makes one problem, then grades the reference solution (should be "correct")
 * and a broken version (should NOT be "correct").
 */
import { readFileSync } from "node:fs";
import { Lesson } from "../lib/schema";
import { gradeAnswer, makePractice } from "../lib/ai/practice";

try {
  process.loadEnvFile(".env.local");
} catch {}

const file = process.argv[2] ?? "mocks/demo/recursion.json";
const lesson = Lesson.parse(JSON.parse(readFileSync(file, "utf8")));
const secs = (t: number) => `${((Date.now() - t) / 1000).toFixed(1)}s`;

let t = Date.now();
const practice = await makePractice({ lesson, avoid: [] });
console.log(`\n📝 practice (${secs(t)})\n${practice.question}\n\nstarter:\n${practice.starterCode ?? "(none)"}\nhint: ${practice.hint ?? "(none)"}\n\nsolution:\n${practice.solution}`);

// A "learner" answer that is probably wrong: the solution with its last non-empty line removed.
const lines = practice.solution.split("\n");
const lastIdx = lines.map((l) => l.trim()).lastIndexOf(lines.filter((l) => l.trim()).at(-1)!.trim());
const broken = lines.filter((_, i) => i !== lastIdx).join("\n");

let failed = 0;
for (const [label, answer, shouldPass] of [
  ["reference solution", practice.solution, true],
  ["broken answer", broken, false],
] as const) {
  t = Date.now();
  const r = await gradeAnswer({ practice, answer, language: lesson.codeLanguage, level: lesson.level });
  const ok = (r.verdict === "correct") === shouldPass;
  if (!ok) failed++;
  console.log(`\n${ok ? "✅" : "❌"} ${label} → ${r.verdict} ${r.score}/100 (${secs(t)})\n   ${r.feedback}${r.line ? `\n   line ${r.line}` : ""}${r.nextHint ? `\n   hint: ${r.nextHint}` : ""}`);
}
process.exit(failed ? 1 : 0);
