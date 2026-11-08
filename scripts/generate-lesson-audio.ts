import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { Lesson as LessonSchema } from "../lib/schema";

dotenv.config({ path: ".env.local" });

if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error("Set ELEVENLABS_API_KEY in .env.local before generating narration.");
}

const lessonPath = path.resolve(process.argv[2] || "mocks/sample-lesson.json");
const lessonName = path.basename(lessonPath, path.extname(lessonPath)).replace(/[^a-zA-Z0-9_-]/g, "-");
const audioDirectory = path.resolve("public/audio", lessonName);
const videoDirectory = path.resolve("public/videos");
const lesson = LessonSchema.parse(JSON.parse(await readFile(lessonPath, "utf8")));
const elevenlabs = new ElevenLabsClient();
const voiceId = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";

await mkdir(audioDirectory, { recursive: true });
await mkdir(videoDirectory, { recursive: true });

for (const chapter of lesson.chapters) {
  for (const scene of chapter.scenes) {
    const narrationHash = createHash("sha256").update(scene.narration).digest("hex").slice(0, 12);
    const fileName = `${scene.id}-${narrationHash}.mp3`;
    const audioPath = path.join(audioDirectory, fileName);
    let audioBytes: Buffer;

    try {
      audioBytes = await readFile(audioPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
        text: scene.narration,
        modelId: "eleven_v4",
        outputFormat: "mp3_44100_128",
      });
      audioBytes = Buffer.from(await new Response(audioStream).arrayBuffer());
      await writeFile(audioPath, audioBytes);
    }

    scene.audio = {
      url: `audio/${lessonName}/${fileName}`,
      durationSec: (audioBytes.byteLength * 8) / 128_000,
    };
    console.log(`Generated narration for ${scene.id} (${scene.audio.durationSec.toFixed(1)}s)`);
    await writeFile(lessonPath, `${JSON.stringify(lesson, null, 2)}\n`);
  }
}

console.log(`Updated scene audio metadata in ${path.relative(process.cwd(), lessonPath)}`);