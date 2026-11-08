import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { POST } from "../app/api/lesson/route";
import { Lesson } from "../lib/schema";

// The video step needs ElevenLabs. Without a key, /api/lesson returns the lesson with no video,
// so say that clearly instead of failing with "Rendered video not found: null".
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
if (!process.env.ELEVENLABS_API_KEY) {
  console.log("⏭  Skipped: add ELEVENLABS_API_KEY to .env.local to test the video pipeline.");
  process.exit(0);
}

const response = await POST(new Request("http://localhost/api/lesson?mock=1", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    prompt: "Check the automatic video pipeline",
    language: "JavaScript",
    mode: "Explainer",
    difficulty: "Beginner",
  }),
}));

const result = await response.json();
if (!response.ok) throw new Error(result.error || `Prompt route failed with ${response.status}.`);

const lesson = Lesson.parse(result.lesson);
const savedLessonPath = path.resolve(result.savedAs);
const videoPath = path.resolve("public", String(result.videoSrc).replace(/^\/+/, ""));
if (!existsSync(savedLessonPath)) throw new Error(`Saved lesson not found: ${result.savedAs}`);
if (!existsSync(videoPath)) throw new Error(`Rendered video not found: ${result.videoSrc}`);

const savedLesson = Lesson.parse(JSON.parse(await readFile(savedLessonPath, "utf8")));
const scenes = savedLesson.chapters.flatMap((chapter) => chapter.scenes);
if (scenes.some((scene) => !scene.audio?.url)) throw new Error("At least one scene is missing audio metadata.");

console.log(`PASS: saved ${result.savedAs}`);
console.log(`PASS: rendered ${result.videoSrc} with audio for ${scenes.length} scenes`);