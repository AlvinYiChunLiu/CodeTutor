"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lesson, Scene } from "@/lib/schema";
import SiteHeader from "@/components/ui/SiteHeader";

type LessonStep = {
  chapterIndex: number;
  sceneIndex: number;
  scene: Scene;
};

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
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
            <span className={`lesson-code-line ${scene.highlightLines.includes(index + 1) ? "line-highlight" : ""}`} key={`${index}-${line}`}>
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
  const [activeStep, setActiveStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const step = steps[activeStep] ?? steps[0];
  const activeChapter = step?.chapterIndex ?? 0;
  const progress = steps.length > 1 ? (activeStep / (steps.length - 1)) * 100 : 100;
  const hasNarrationAudio = steps.some(({ scene }) => Boolean(scene.audio?.url));

  useEffect(() => {
    if (!playing) return;
    if (activeStep >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setActiveStep(activeStep + 1), 6500);
    return () => window.clearTimeout(timer);
  }, [activeStep, playing, steps.length]);

  function chooseStep(index: number) {
    setActiveStep(index);
    setPlaying(false);
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
            <span className="lesson-length"><span>◷</span> 4 min</span>
          </div>

          <div className="lesson-player">
            <SceneVisual key={step.scene.id} scene={step.scene} language={lesson.codeLanguage} />
            <div className="player-controls">
              <div className="player-control-row">
                <button className="play-button" type="button" aria-label={playing ? "Pause auto-play" : "Auto-play lesson preview"} onClick={() => {
                  if (activeStep >= steps.length - 1 && !playing) setActiveStep(0);
                  setPlaying(!playing);
                }}>
                  {playing ? <span className="pause-icon">Ⅱ</span> : <span className="play-icon">▶</span>}
                </button>
                <div className="player-narration">
                  <span>{playing ? "AUTO-PLAYING VISUALS" : `CHAPTER ${String(activeChapter + 1).padStart(2, "0")}`}</span>
                  <p>{step.scene.narration}</p>
                </div>
                <span className="player-time">{formatTime(Math.round((activeStep / Math.max(steps.length, 1)) * 240))} <i>/</i> 4:00</span>
              </div>
              <div className="progress-track" role="progressbar" aria-label="Lesson progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="section-eyebrow">{hasNarrationAudio ? "VIDEO EXPORT · NARRATED" : "VIDEO EXPORT · SILENT"}</span>
                <h2 className="mt-2 text-xl font-semibold text-neutral-100">{hasNarrationAudio ? "Narrated lesson video" : "Silent lesson video"}</h2>
              </div>
              <a className="rounded-md border border-white/15 px-4 py-2 text-sm text-neutral-200 transition hover:border-lime-300 hover:text-lime-200" href={videoSrc} download>
                Download MP4
              </a>
            </div>
            <video className="aspect-video w-full rounded-lg bg-black" controls preload="metadata" src={videoSrc}>
              Your browser does not support HTML video.
            </video>
          </section>

          <section className="transcript-section">
            <div className="transcript-heading">
              <div><span className="section-eyebrow">FOLLOW ALONG</span><h2>Lesson transcript</h2></div>
              <span className="transcript-count">{steps.length} moments</span>
            </div>
            <div className="transcript-list">
              {steps.map((item, index) => (
                <button type="button" key={item.scene.id} className={`transcript-item ${index === activeStep ? "transcript-active" : ""}`} onClick={() => chooseStep(index)}>
                  <span className="transcript-time">{formatTime(Math.round((index / Math.max(steps.length, 1)) * 240))}</span>
                  <span className="transcript-indicator">{index === activeStep ? "▶" : String(index + 1).padStart(2, "0")}</span>
                  <span className="transcript-copy"><b>{lesson.chapters[item.chapterIndex].title}</b><span>{item.scene.narration}</span></span>
                  {index === activeStep && <span className="transcript-now">NOW</span>}
                </button>
              ))}
            </div>
          </section>

          {lesson.practice && (
            <section className="practice-card">
              <div className="practice-card-icon">✓</div>
              <div className="practice-copy">
                <span className="section-eyebrow">YOUR TURN</span>
                <h2>Ready to try one?</h2>
                <p>{lesson.practice.question}</p>
                {practiceOpen && (
                  <div className="practice-answer">
                    {lesson.practice.hint && <p><b>Hint:</b> {lesson.practice.hint}</p>}
                    <span>ONE POSSIBLE SOLUTION</span>
                    <pre>{lesson.practice.solution}</pre>
                  </div>
                )}
              </div>
              <button type="button" className="practice-button" onClick={() => setPracticeOpen(!practiceOpen)}>
                {practiceOpen ? "Hide solution" : "Show a hint"} <span>{practiceOpen ? "−" : "+"}</span>
              </button>
            </section>
          )}
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
      </div>
    </main>
  );
}
