import path from "node:path";
import { Lesson as LessonSchema } from "../lib/schema";
import { generateLessonAudio } from "../lib/ai/audio";
import { renderLessonVideo } from "../lib/video/render-lesson";

const lessonPath = path.resolve(process.argv[2] || "mocks/lesson-recursion.json");
const lesson = await generateLessonAudio(lessonPath);
const videoSrc = await renderLessonVideo(LessonSchema.parse(lesson), lessonPath);

console.log(`VIDEO_SRC=${videoSrc}`);