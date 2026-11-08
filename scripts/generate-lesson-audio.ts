import path from "node:path";
import { generateLessonAudio } from "../lib/ai/audio";

const lessonPath = path.resolve(process.argv[2] || "mocks/sample-lesson.json");
await generateLessonAudio(lessonPath);
console.log(`Updated scene audio metadata in ${path.relative(process.cwd(), lessonPath)}`);