"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Lesson, Scene } from "@/lib/schema";
import SiteHeader from "@/components/ui/SiteHeader";
import PracticePanel from "@/components/ui/PracticePanel";
import AdjustLesson from "@/components/ui/AdjustLesson";
import { sceneDurationInFrames } from "@/remotion/timeline";

type LessonStep = {
  chapterIndex: number;
  sceneIndex: number;
  scene: Scene;
};

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * How long a scene lasts, using the exact same timing the video renderer uses (remotion/timeline.ts):
 * the narration audio's length (or an estimate) plus a short pause. So page times match the video.
 */
const VIDEO_FPS = 30;
function sceneSeconds(scene: Scene) {
  return sceneDurationInFrames(scene) / VIDEO_FPS;
}

function lessonLength(totalSeconds: number) {
  return totalSeconds < 60 ? "under 1 min" : `${Math.round(totalSeconds / 60)} min`;
}

function SceneVisual({ scene, language }: { scene: Scene; language: string }) {
  if (scene.type === "title") {
    return (
      <div className="visual-title-scene">
        <div className="visual-orbit orbit-one" />
        <div className="visual-orbit orbit-two" />
        <span className="visual-tag">A CODETUTOR MINI-LESSON</span>
        <h2>{scene.heading}</h2>
        {scene.subheading && <p>{scene.subheading}</p>}
        <span className="visual-title-spark" aria-hidden="true">&lt;/&gt;</span>
      </div>
    );
  }

  if (scene.type === "code") {
    const lines = scene.code.split("\n");
    return (
      <div className="visual-code-scene">
        <div className="visual-window-top">
          <div className="window-dots"><i /><i /><i /></div>
          <span>{language.toLowerCase()} · example</span>
          <span className="window-menu">···</span>
        </div>
        <pre className="lesson-code">
  {lines.map((line, index) => (
    <span
      className={`lesson-code-line ${scene.highlightLines.includes(index + 1) ? "line-highlight" : ""}`}
      key={`${index}-${line}`}
      ref={(el) => {
        if (el && scene.highlightLines[0] === index + 1 && el.parentElement) {
          el.parentElement.scrollTop = el.offsetTop - 40;
        }
      }}
    >
      <span className="line-number">{index + 1}</span><code>{line || " "}</code>
    </span>
  ))}
</pre>
        <div className="code-scene-note"><span /> FOLLOW THE HIGHLIGHT</div>
      </div>
    );
  }

  if (scene.type === "output") {
    return (
      <div className="visual-output-scene">
        <div className="output-window">
          <div className="output-window-top"><span className="terminal-prompt">●</span> Terminal <span>—</span></div>
          <pre>{scene.output}</pre>
        </div>
        <div className="output-success"><span>✓</span> And there’s your result.</div>
      </div>
    );
  }

  if (scene.type === "diagram") {
    const diagram = scene.diagram;
    if (diagram.kind === "callstack") {
      return (
        <div className="visual-diagram-scene">
          <div className="diagram-caption"><span className="diagram-live-dot" /> THE CALL STACK</div>
          <div className="stack-frames">
            {[...diagram.frames].reverse().map((frame, index) => (
              <div className={`stack-frame ${index === 0 ? "stack-frame-active" : ""}`} key={`${frame.call}-${index}`}>
                <span className="frame-index">0{diagram.frames.length - index}</span>
                <strong>{frame.call}</strong>
                <span className="frame-vars">{Object.entries(frame.vars).map(([name, value]) => `${name} = ${value}`).join(" · ")}</span>
                {frame.returns && <span className="frame-return">returns {frame.returns}</span>}
              </div>
            ))}
          </div>
          <div className="stack-direction"><span>CALL</span><i>↓</i><span>RETURN</span></div>
        </div>
      );
    }

    return (
      <div className="visual-diagram-scene">
        <div className="diagram-caption"><span className="diagram-live-dot" /> STEP THROUGH THE ARRAY</div>
        <div className="array-cells">
          {diagram.values.map((value, index) => (
            <div className="array-cell-wrap" key={`${value}-${index}`}>
              <div className={`array-cell ${diagram.highlight.includes(index) ? "array-cell-active" : ""}`}>{value}</div>
              <span>{index}</span>
              {diagram.pointers.filter((pointer) => pointer.index === index).map((pointer) => (
                <b className="array-pointer" key={pointer.label}>{pointer.label} <i>↑</i></b>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="visual-recap-scene">
      <span className="recap-spark" aria-hidden="true">&lt;/&gt;</span>
      <span className="visual-tag">THE BIG TAKEAWAYS</span>
      <h2>Keep these in<br />your toolkit.</h2>
      <ol>{scene.points.map((point, index) => <li key={point}><span>0{index + 1}</span>{point}</li>)}</ol>
    </div>
  );
}

export default function InteractiveLesson({ lesson, videoSrc = "/videos/recursion-lesson.mp4" }: { lesson: Lesson; videoSrc?: string }) {
  const steps = useMemo<LessonStep[]>(
    () => lesson.chapters.flatMap((chapter, chapterIndex) => chapter.scenes.map((scene, sceneIndex) => ({ chapterIndex, sceneIndex, scene }))),
    [lesson],
  );
  // Real timeline: where each scene starts and how long the whole lesson is.
  const timeline = useMemo(() => {
    const starts: number[] = [];
    let total = 0;
    for (const { scene } of steps) {
      starts.push(total);
      total += sceneSeconds(scene);
    }
    return { starts, total };
  }, [steps]);
  const [activeStep, setActiveStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const step = steps[activeStep] ?? steps[0];
  const activeChapter = step?.chapterIndex ?? 0;
  const progress = timeline.total > 0 ? Math.min(100, (elapsed / timeline.total) * 100) : 0;
  const hasNarrationAudio = steps.some(({ scene }) => Boolean(scene.audio?.url));

  // Auto-play: the clock ticks, and each scene stays up for its own length.
  useEffect(() => {
    if (!playing) return;
    const started = performance.now();
    const from = elapsed;
    const timer = window.setInterval(() => setElapsed(Math.min(timeline.total, from + (performance.now() - started) / 1000)), 200);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, timeline.total]);

  useEffect(() => {
    if (!playing) return;
    if (elapsed >= timeline.total) {
      setPlaying(false);
      return;
    }
    const sceneEnd = (timeline.starts[activeStep + 1] ?? timeline.total);
    if (elapsed >= sceneEnd && activeStep < steps.length - 1) setActiveStep(activeStep + 1);
  }, [elapsed, playing, activeStep, steps.length, timeline]);

  function chooseStep(index: number) {
    setActiveStep(index);
    setElapsed(timeline.starts[index] ?? 0);
    setPlaying(false);
  }

  // The video below: transcript clicks jump it to that moment, and while it plays the transcript follows it.
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoInSync, setVideoInSync] = useState(false);

  function checkVideoMatches() {
    const video = videoRef.current;
    // Only seek a video made from THIS lesson (a sample page may show another lesson's video).
    setVideoInSync(Boolean(video && Number.isFinite(video.duration) && Math.abs(video.duration - timeline.total) < 2));
  }

  function sceneAt(seconds: number) {
    let index = 0;
    while (index + 1 < timeline.starts.length && timeline.starts[index + 1] <= seconds + 0.05) index++;
    return index;
  }

  function jumpTo(index: number) {
    chooseStep(index);
    const video = videoRef.current;
    if (!video || !videoInSync) return;
    video.currentTime = (timeline.starts[index] ?? 0) + 0.05;
    void video.play().catch(() => {});
    const box = video.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) video.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (!step) return null;

  return (
    <main className="lesson-shell">
      <SiteHeader badge="SAMPLE LESSON" />

      <div className="lesson-layout">
        <section className="lesson-main">
          <div className="lesson-title-row">
            <div>
              <div className="lesson-breadcrumb">YOUR LEARNING SPACE <span>/</span> {lesson.level.toUpperCase()}</div>
              <h1>{lesson.title}</h1>
              <p>{lesson.summary}</p>
            </div>
            <span className="lesson-length"><span>◷</span> {lessonLength(timeline.total)}</span>
          </div>
          <AdjustLesson lesson={lesson} />

          <div className="lesson-player">
            <SceneVisual key={step.scene.id} scene={step.scene} language={lesson.codeLanguage} />
            <div className="player-controls">
              <div className="player-control-row">
                <button className="play-button" type="button" aria-label={playing ? "Pause auto-play" : "Auto-play lesson preview"} onClick={() => {
                  if (!playing && elapsed >= timeline.total - 0.25) {
                    setActiveStep(0);
                    setElapsed(0);
                  } else if (!playing && elapsed < (timeline.starts[activeStep] ?? 0)) {
                    setElapsed(timeline.starts[activeStep] ?? 0);
                  }
                  setPlaying(!playing);
                }}>
                  {playing ? <span className="pause-icon">Ⅱ</span> : <span className="play-icon">▶</span>}
                </button>
                <div className="player-narration">
                  <span>{playing ? "AUTO-PLAYING VISUALS" : `CHAPTER ${String(activeChapter + 1).padStart(2, "0")}`}</span>
                  <p>{step.scene.narration}</p>
                </div>
                <span className="player-time">{formatTime(elapsed)} <i>/</i> {formatTime(Math.round(timeline.total))}</span>
              </div>
              <div className="progress-track" role="progressbar" aria-label="Lesson progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

        </section>

        <aside className="lesson-sidebar">
          <div className="sidebar-heading"><span className="section-eyebrow">ON THIS PAGE</span><span className="sidebar-progress">{activeStep + 1} / {steps.length}</span></div>
          <div className="chapter-list">
            {lesson.chapters.map((chapter, chapterIndex) => {
              const firstStep = steps.findIndex((item) => item.chapterIndex === chapterIndex);
              const chapterSteps = steps.map((item, index) => ({ item, index })).filter(({ item }) => item.chapterIndex === chapterIndex);
              const completed = chapterSteps.every(({ index }) => index < activeStep);
              return (
                <div className={`chapter-group ${chapterIndex === activeChapter ? "chapter-current" : ""}`} key={chapter.id}>
                  <button type="button" className="chapter-button" onClick={() => chooseStep(firstStep)}>
                    <span className={`chapter-marker ${completed ? "chapter-completed" : ""}`}>{completed ? "✓" : String(chapterIndex + 1).padStart(2, "0")}</span>
                    <span><b>{chapter.title}</b><small>{chapter.scenes.length} {chapter.scenes.length === 1 ? "moment" : "moments"}</small></span>
                    <span className="chapter-chevron">{chapterIndex === activeChapter ? "⌄" : "›"}</span>
                  </button>
                  {chapterIndex === activeChapter && (
                    <div className="chapter-scenes">
                      {chapter.scenes.map((scene, sceneIndex) => {
                        const sceneStep = firstStep + sceneIndex;
                        return <button type="button" key={scene.id} className={sceneStep === activeStep ? "scene-current" : ""} onClick={() => chooseStep(sceneStep)}><i />{scene.type === "code" ? "Walk through the code" : scene.type === "diagram" ? "See it visualized" : scene.type === "output" ? "Check the result" : scene.type === "recap" ? "Key takeaways" : "Get the big picture"}</button>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="sidebar-note">
            <span className="sidebar-note-arrow">↳</span>
            <b>Take it at your pace.</b>
            <p>Click any moment in the transcript to jump right to it.</p>
          </div>
          <div className="sidebar-footer"><span>MADE TO MAKE IT CLICK</span><span>●</span></div>
        </aside>

        <div className="lesson-wide">
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="section-eyebrow">{hasNarrationAudio ? "VIDEO EXPORT · NARRATED" : "VIDEO EXPORT · SILENT"}</span>
                <h2 className="mt-2 text-[1.375rem] font-semibold text-neutral-100">{hasNarrationAudio ? "Narrated lesson video" : "Silent lesson video"}</h2>
              </div>
              <a className="rounded-md border border-white/15 px-4 py-2 text-base text-neutral-200 transition hover:border-lime-300 hover:text-lime-200" href={videoSrc} download>
                Download MP4
              </a>
            </div>
            <video
              ref={videoRef}
              className="aspect-video w-full rounded-lg bg-black"
              controls
              preload="metadata"
              src={videoSrc}
              onLoadedMetadata={checkVideoMatches}
              onPlay={() => setPlaying(false)}
              onTimeUpdate={(e) => {
                if (!videoInSync || e.currentTarget.paused) return;
                const t = e.currentTarget.currentTime;
                setElapsed(t);
                const index = sceneAt(t);
                if (index !== activeStep) setActiveStep(index);
              }}
            >
              Your browser does not support HTML video.
            </video>
          </section>

          <section className="transcript-section">
            <div className="transcript-heading">
              <div><span className="section-eyebrow">FOLLOW ALONG</span><h2>Lesson transcript</h2></div>
              <span className="transcript-count">{videoInSync ? "Click a moment to jump the video there · " : ""}{steps.length} moments</span>
            </div>
            <div className="transcript-list">
              {steps.map((item, index) => (
                <button type="button" key={item.scene.id} className={`transcript-item ${index === activeStep ? "transcript-active" : ""}`} onClick={() => jumpTo(index)} title={videoInSync ? `Play the video from ${formatTime(timeline.starts[index] ?? 0)}` : undefined}>
                  <span className="transcript-time">{formatTime(timeline.starts[index] ?? 0)}</span>
                  <span className="transcript-indicator">{index === activeStep ? "▶" : String(index + 1).padStart(2, "0")}</span>
                  <span className="transcript-copy"><b>{lesson.chapters[item.chapterIndex].title}</b><span>{item.scene.narration}</span></span>
                  {index === activeStep && <span className="transcript-now">NOW</span>}
                </button>
              ))}
            </div>
          </section>

          <PracticePanel lesson={lesson} />
        </div>
      </div>
    </main>
  );
}
