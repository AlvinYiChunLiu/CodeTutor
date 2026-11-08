import { readFileSync } from "node:fs";
import { Lesson } from "../lib/schema";

const file = process.argv[2] ?? "mocks/lesson-recursion.json";
const result = Lesson.safeParse(JSON.parse(readFileSync(file, "utf8")));

if (!result.success) {
  console.error(`❌ ${file} is invalid:`);
  for (const issue of result.error.issues) {
    console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  process.exit(1);
}

// Scene ids must be unique so audio and captions can be matched to scenes.
const ids = result.data.chapters.flatMap((c) => c.scenes.map((s) => s.id));
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) {
  console.error(`❌ Duplicate scene ids: ${[...new Set(dupes)].join(", ")}`);
  process.exit(1);
}

const scenes = ids.length;
console.log(`✅ Valid: "${result.data.title}" (${result.data.chapters.length} chapters, ${scenes} scenes)`);
