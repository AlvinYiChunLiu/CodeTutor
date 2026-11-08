/**
 * npm run demo:videos [slug…] — narrate and render the demo lessons once, so demo topics are instant.
 * Needs ELEVENLABS_API_KEY in .env.local. Skips lessons whose video is already up to date.
 * Then commit mocks/demo-voiced/ and public/videos/demo/.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEMO_TOPICS } from "../lib/ai/demo-topics";
import { generateLessonAudio } from "../lib/ai/audio";
import { renderLessonVideo } from "../lib/video/render-lesson";
import { cachedDemoVideo, loadDemoLesson, storeDemoVideo } from "../lib/demo-cache";

const wanted = process.argv.slice(2);
const topics = wanted.length ? DEMO_TOPICS.filter((t) => wanted.includes(t.slug)) : DEMO_TOPICS;
if (wanted.length && topics.length !== wanted.length) {
  console.error(`Unknown slug. Choose from: ${DEMO_TOPICS.map((t) => t.slug).join(", ")}`);
  process.exit(1);
}

const workDir = path.join(process.cwd(), "mocks", "generated");
await mkdir(workDir, { recursive: true });

for (const topic of topics) {
  const lesson = await loadDemoLesson(topic.slug);
  if (await cachedDemoVideo(topic.slug, lesson)) {
    console.log(`✓ ${topic.slug}: already up to date`);
    continue;
  }
  const started = Date.now();
  console.log(`… ${topic.slug}: narrating and rendering`);
  const workFile = path.join(workDir, `demo-${topic.slug}.json`);
  await writeFile(workFile, `${JSON.stringify(lesson, null, 2)}\n`);
  const voiced = await generateLessonAudio(workFile);
  const rendered = await renderLessonVideo(voiced, workFile);
  const videoSrc = await storeDemoVideo(topic.slug, voiced, rendered);
  console.log(`✓ ${topic.slug}: public${videoSrc} (${Math.round((Date.now() - started) / 1000)}s)`);
}
console.log("\nDone. Commit mocks/demo-voiced/ and public/videos/demo/.");
