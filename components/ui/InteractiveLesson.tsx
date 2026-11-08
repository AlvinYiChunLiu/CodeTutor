"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lesson, Scene } from "@/lib/schema";
import SiteHeader from "@/components/ui/SiteHeader";
import PracticePanel from "@/components/ui/PracticePanel";
import AdjustLesson from "@/components/ui/AdjustLesson";
import { sceneDurationInFrames } from "@/remotion/timeline";
import { sceneLabel } from "@/lib/scene-label";

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

export default function InteractiveLesson({ lesson, videoSrc }: { lesson: Lesson; videoSrc?: string }) {
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

  const chooseStep = useCallback((index: number) => {
    setActiveStep(index);
    setElapsed(timeline.starts[index] ?? 0);
    setPlaying(false);
  }, [timeline.starts]);

  // The video below: transcript clicks jump it to that moment, and while it plays the transcript follows it.
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoInSync, setVideoInSync] = useState(false);

  const selectSlide = useCallback((index: number) => {
    chooseStep(index);
    if (videoInSync) videoRef.current?.pause();
  }, [chooseStep, videoInSync]);

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

  const jumpTo = useCallback((index: number) => {
    chooseStep(index);
    const video = videoRef.current;
    if (!video || !videoInSync) return;
    video.currentTime = (timeline.starts[index] ?? 0) + 0.05;
    void video.play().catch(() => {});
    const box = video.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) video.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [chooseStep, videoInSync, timeline.starts]);

  useEffect(() => {
    function handleArrowNavigation(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;

      const nextStep = activeStep + (event.key === "ArrowRight" ? 1 : -1);
      if (nextStep < 0 || nextStep >= steps.length) return;
      event.preventDefault();
      selectSlide(nextStep);
    }

    window.addEventListener("keydown", handleArrowNavigation, true);
    return () => window.removeEventListener("keydown", handleArrowNavigation, true);
  }, [activeStep, selectSlide, steps.length]);

  if (!step) return null;

  return (
    <main className="lesson-shell">
      <SiteHeader />

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

          <div
            className="lesson-player"
            tabIndex={0}
            role="group"
            aria-label="Lesson chapter slides. Use left and right arrow keys anywhere on this page to change slides."
            aria-keyshortcuts="ArrowLeft ArrowRight"
          >
            <SceneVisual key={step.scene.id} scene={step.scene} language={lesson.codeLanguage} />
            <div className="player-controls">
              <div className="player-control-row">
                <button
                  className="player-step-button"
                  type="button"
                  aria-label="Previous slide"
                  title="Previous slide · Left arrow"
                  onClick={() => selectSlide(activeStep - 1)}
                  disabled={activeStep === 0}
                >
                  <span aria-hidden="true">←</span>
                </button>
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
                <button
                  className="player-step-button"
                  type="button"
                  aria-label="Next slide"
                  title="Next slide · Right arrow"
                  onClick={() => selectSlide(activeStep + 1)}
                  disabled={activeStep === steps.length - 1}
                >
                  <span aria-hidden="true">→</span>
                </button>
              </div>
              <span className="player-keyboard-hint">Use ← → anywhere on this page to change slides</span>
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
                  <button type="button" className="chapter-button" onClick={() => selectSlide(firstStep)}>
                    <span className={`chapter-marker ${completed ? "chapter-completed" : ""}`}>{completed ? "✓" : String(chapterIndex + 1).padStart(2, "0")}</span>
                    <span><b>{chapter.title}</b><small>{chapter.scenes.length} {chapter.scenes.length === 1 ? "moment" : "moments"}</small></span>
                    <span className="chapter-chevron">{chapterIndex === activeChapter ? "⌄" : "›"}</span>
                  </button>
                  {chapterIndex === activeChapter && (
                    <div className="chapter-scenes">
                      {chapter.scenes.map((scene, sceneIndex) => {
                        const sceneStep = firstStep + sceneIndex;
                        return <button type="button" key={scene.id} className={sceneStep === activeStep ? "scene-current" : ""} onClick={() => selectSlide(sceneStep)}><i />{sceneLabel(scene)}</button>;
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
          {videoSrc ? (
            <section className="lesson-video-card">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <span className="section-eyebrow">{hasNarrationAudio ? "VIDEO EXPORT · NARRATED" : "VIDEO EXPORT · SILENT"}</span>
                  <h2 className="mt-2 text-[1.375rem] font-semibold text-neutral-100">{hasNarrationAudio ? "Narrated lesson video" : "Silent lesson video"}</h2>
                </div>
                <a className="lesson-video-download" href={videoSrc} download>
                  Download MP4
                </a>
              </div>
              <video
                ref={videoRef}
                className="lesson-export-video"
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
          ) : (
            <section className="lesson-video-card lesson-video-missing">
              <span className="section-eyebrow">VIDEO EXPORT</span>
              <h2 className="mt-2 text-[1.375rem] font-semibold text-neutral-100">No video for this lesson</h2>
              <p className="mt-2">The slides above have the whole lesson: step through them with the arrows or the transcript below.</p>
            </section>
          )}

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
