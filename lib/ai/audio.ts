import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { Lesson as LessonSchema, type Lesson } from "../schema";

export async function generateLessonAudio(lessonPath: string): Promise<Lesson> {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error("Set ELEVENLABS_API_KEY in .env.local before generating narration.");
  }

  const resolvedLessonPath = path.resolve(lessonPath);
  const lessonName = path.basename(resolvedLessonPath, path.extname(resolvedLessonPath))
    .replace(/[^a-zA-Z0-9_-]/g, "-");
  const audioDirectory = path.resolve(process.cwd(), "public/audio/generated", lessonName);
  const lesson = LessonSchema.parse(JSON.parse(await readFile(resolvedLessonPath, "utf8")));
  const elevenlabs = new ElevenLabsClient();
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";

  await mkdir(audioDirectory, { recursive: true });

  for (const chapter of lesson.chapters) {
    for (const scene of chapter.scenes) {
      const safeSceneId = scene.id.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 40) || "scene";
      const narrationHash = createHash("sha256")
        .update(`${scene.id}\0${scene.narration}`)
        .digest("hex")
        .slice(0, 12);
      const fileName = `${safeSceneId}-${narrationHash}.mp3`;
      const audioPath = path.join(audioDirectory, fileName);
      let audioBytes: Buffer | undefined;

      try {
        audioBytes = await readFile(audioPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }

      if (!audioBytes && scene.audio?.url.startsWith("audio/")) {
        const existingAudioPath = path.resolve(process.cwd(), "public", scene.audio.url);
        const publicAudioRoot = `${path.resolve(process.cwd(), "public/audio")}${path.sep}`;
        if (existingAudioPath.startsWith(publicAudioRoot)) {
          try {
            audioBytes = await readFile(existingAudioPath);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
        }
      }

      if (!audioBytes) {
        const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
          text: scene.narration,
          modelId: "eleven_v4",
          outputFormat: "mp3_44100_128",
        });
        audioBytes = Buffer.from(await new Response(audioStream).arrayBuffer());
      }
      if (!audioBytes) throw new Error(`Could not prepare narration for scene ${scene.id}.`);
      await writeFile(audioPath, audioBytes);

      scene.audio = {
        url: `audio/generated/${lessonName}/${fileName}`,
        durationSec: scene.audio?.durationSec ?? (audioBytes.byteLength * 8) / 128_000,
      };
      await writeFile(resolvedLessonPath, `${JSON.stringify(lesson, null, 2)}\n`);
      console.log(`[audio] ${scene.id}: ${scene.audio.durationSec.toFixed(1)}s`);
    }
  }

  return lesson;
}