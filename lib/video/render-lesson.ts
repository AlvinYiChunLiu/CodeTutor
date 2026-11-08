import { mkdir } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { Lesson } from "../schema";

export async function renderLessonVideo(lesson: Lesson, lessonPath: string) {
  const inputProps = { lesson };
  const serveUrl = await bundle({
    entryPoint: path.resolve(process.cwd(), "remotion/index.ts"),
    onProgress: (progress) => console.log(`[render] bundling ${Math.round(progress)}%`),
  });
  console.log(`[render] bundle ready: ${serveUrl}`);
  const composition = await selectComposition({
    serveUrl,
    id: "GeneratedLesson",
    inputProps,
  });
  console.log(`[render] composition selected: ${composition.durationInFrames} frames`);

  const videoDirectory = path.resolve(process.cwd(), "public/videos/generated");
  const fileName = `${path.basename(lessonPath, path.extname(lessonPath))}.mp4`;
  const outputLocation = path.join(videoDirectory, fileName);
  await mkdir(videoDirectory, { recursive: true });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps,
    concurrency: 2,
    onProgress: ({ progress }) => console.log(`[render] ${(progress * 100).toFixed(0)}%`),
  });
  console.log(`[render] wrote ${outputLocation}`);

  return `/videos/generated/${fileName}`;
}