import type { CSSProperties } from "react";
import {
	AbsoluteFill,
	Sequence,
	interpolate,
	useCurrentFrame,
} from "remotion";
import type { Lesson, Scene } from "../lib/schema";
import { flattenLessonScenes, sceneDurationInFrames, type LessonSceneEntry } from "./timeline";

type LessonVideoProps = { lesson: Lesson };

function SceneContent({ scene, language, lessonTitle, frame, durationInFrames }: { scene: Scene; language: string; lessonTitle: string; frame: number; durationInFrames: number }) {
	if (scene.type === "title") {
		return (
			<div style={{ maxWidth: 1050 }}>
				<p style={styles.eyebrow}>A CODETUTOR LESSON</p>
				<h1 style={styles.title}>{scene.heading}</h1>
				{scene.subheading && <p style={styles.subtitle}>{scene.subheading}</p>}
			</div>
		);
	}

	if (scene.type === "code") {
		const lines = scene.code.split("\n");
		const longestLine = Math.max(0, ...lines.map((line) => line.length));
		const fontSize = Math.max(14, Math.min(25, 25 - Math.max(0, longestLine - 48) * 0.18, 28 / Math.max(1, lines.length / 15)));
		const lineHeight = fontSize * 1.45 + 4;
		const visibleLines = Math.max(1, Math.floor(320 / lineHeight));
		const maxScrollLines = Math.max(0, lines.length - visibleLines);
		const focusLine = scene.highlightLines.length
			? scene.highlightLines.reduce((sum, line) => sum + line - 1, 0) / scene.highlightLines.length
			: maxScrollLines;
		const targetScrollLines = Math.max(0, Math.min(maxScrollLines, focusLine - (visibleLines - 1) / 2));
		const scrollOffset = interpolate(frame, [0, durationInFrames], [0, targetScrollLines * lineHeight], { extrapolateRight: "clamp" });
		return (
			<div style={styles.codeWindow}>
				<div style={styles.codeHeader}><span style={styles.windowDots}>● ● ●</span><span>{language.toUpperCase()} · EXAMPLE</span></div>
				<div style={styles.codeViewport}>
					<pre style={{ ...styles.codeBlock, fontSize, lineHeight: 1.45, transform: `translateY(-${scrollOffset}px)` }}>
						{lines.map((line, index) => (
							<div key={`${index}-${line}`} style={{ ...styles.codeLine, fontSize, backgroundColor: scene.highlightLines.includes(index + 1) ? "#c9ef7420" : "transparent", color: scene.highlightLines.includes(index + 1) ? "#d8ff8a" : "#e4e8df" }}>
								<span style={{ ...styles.lineNumber, fontSize: Math.max(11, fontSize * 0.6) }}>{String(index + 1).padStart(2, "0")}</span>{line || " "}
							</div>
						))}
					</pre>
				</div>
			</div>
		);
	}

	if (scene.type === "output") {
		return (
			<div style={styles.outputWindow}>
				<p style={styles.eyebrow}>PROGRAM OUTPUT</p>
				<pre style={styles.outputText}>{scene.output}</pre>
				<p style={styles.outputResult}>The program prints this result.</p>
			</div>
		);
	}

	if (scene.type === "diagram") {
		const diagram = scene.diagram;
		if (diagram.kind === "callstack") {
			return (
				<div style={{ width: 850 }}>
					<p style={styles.eyebrow}>THE CALL STACK</p>
					<div style={styles.stackList}>
						{[...diagram.frames].reverse().map((frame, index) => (
							<div key={`${frame.call}-${index}`} style={{ ...styles.stackFrame, borderColor: index === 0 ? "#c9ef74" : "#ffffff25" }}>
								<span style={styles.lineNumber}>LEVEL {diagram.frames.length - index}</span>
								<strong style={styles.stackCall}>{frame.call}</strong>
								<span style={styles.stackVars}>{Object.entries(frame.vars).map(([name, value]) => `${name} = ${value}`).join(" · ")}</span>
								{frame.returns && <span style={styles.stackReturn}>returns {frame.returns}</span>}
							</div>
						))}
					</div>
				</div>
			);
		}

		return (
			<div style={{ width: 850 }}>
				<p style={styles.eyebrow}>STEP THROUGH THE ARRAY</p>
				<div style={styles.arrayRow}>
					{diagram.values.map((value, index) => (
						<div key={`${value}-${index}`} style={{
							...styles.arrayCell,
							borderColor: diagram.highlight.includes(index) ? "#c9ef74" : "#ffffff30",
							color: diagram.highlight.includes(index) ? "#d8ff8a" : "#f3f1e7",
						}}>
							<strong>{value}</strong><span>{index}</span>
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div style={{ width: 900 }}>
			<p style={styles.eyebrow}>THE BIG TAKEAWAYS</p>
			<h2 style={styles.recapTitle}>{lessonTitle}: key ideas.</h2>
			<ol style={styles.recapList}>
				{scene.points.map((point, index) => (
					<li key={point}><span style={styles.recapNumber}>0{index + 1}</span>{point}</li>
				))}
			</ol>
		</div>
	);
}

function LessonScene({ item, index, total, durationInFrames, lessonTitle, language }: {
	item: LessonSceneEntry;
	index: number;
	total: number;
	durationInFrames: number;
	lessonTitle: string;
	language: string;
}) {
	const frame = useCurrentFrame();
	const entrance = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
	const lift = interpolate(frame, [0, 18], [22, 0], { extrapolateRight: "clamp" });
	const progress = Math.min(100, (frame / durationInFrames) * 100);
	const wordTimings = item.scene.audio?.wordTimings;
	const activeWordIndex = wordTimings?.findIndex(
		({ startSec, endSec }) => frame / 30 >= startSec && frame / 30 < endSec,
	) ?? -1;

	return (
		<AbsoluteFill style={styles.canvas}>
			<div style={styles.grid} />
			<div style={styles.topRule}><div style={{ ...styles.progress, width: `${progress}%` }} /></div>
			<header style={styles.header}>
				<span style={styles.brand}>CODETUTOR<span style={styles.brandDot}>.</span></span>
				<span style={styles.lessonLabel}>{language.toUpperCase()} / {lessonTitle.toUpperCase()}</span>
				<span style={styles.chapterLabel}>CHAPTER {String(item.chapterNumber).padStart(2, "0")} · {item.chapterTitle.toUpperCase()}</span>
			</header>
			<main style={{ ...styles.main, opacity: entrance, transform: `translateY(${lift}px)` }}>
				<SceneContent scene={item.scene} language={language} lessonTitle={lessonTitle} frame={frame} durationInFrames={durationInFrames} />
			</main>
			<footer style={styles.footer}>
				<div style={styles.captionMark} />
				<p style={styles.caption}>
					{wordTimings?.length
						? wordTimings.map(({ word }, wordIndex) => (
							<span key={`${wordIndex}-${word}`} style={wordIndex === activeWordIndex ? styles.activeCaptionWord : undefined}>{word}{wordIndex < wordTimings.length - 1 ? " " : ""}</span>
						))
						: item.scene.narration}
				</p>
				<span style={styles.sceneCount}>{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
			</footer>
		</AbsoluteFill>
	);
}

export function LessonVideo({ lesson }: LessonVideoProps) {
	const scenes = flattenLessonScenes(lesson);
	let nextFrame = 0;

	return (
		<AbsoluteFill style={styles.canvas}>
			{scenes.map((item, index) => {
				const durationInFrames = sceneDurationInFrames(item.scene);
				const from = nextFrame;
				nextFrame += durationInFrames;

				return (
					<Sequence key={item.scene.id} from={from} durationInFrames={durationInFrames}>
						<LessonScene
							item={item}
							index={index}
							total={scenes.length}
							durationInFrames={durationInFrames}
							lessonTitle={lesson.title}
							language={lesson.codeLanguage}
						/>
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
}

const styles: Record<string, CSSProperties> = {
	canvas: { backgroundColor: "#151a16", color: "#f3f1e7", fontFamily: "Arial, sans-serif", overflow: "hidden" },
	grid: { position: "absolute", inset: 0, opacity: 0.22, backgroundImage: "linear-gradient(#ffffff0b 1px, transparent 1px), linear-gradient(90deg, #ffffff0b 1px, transparent 1px)", backgroundSize: "48px 48px" },
	topRule: { position: "absolute", inset: "0 0 auto", height: 5, backgroundColor: "#ffffff16" },
	progress: { height: "100%", backgroundColor: "#c9ef74" },
	header: { position: "absolute", top: 34, left: 58, right: 58, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 25, fontSize: 13, letterSpacing: 2, color: "#a9b39f" },
	brand: { color: "#f3f1e7", fontWeight: 700 },
	brandDot: { color: "#d98263" },
	lessonLabel: { flex: 1, textAlign: "center" },
	chapterLabel: { textAlign: "right", fontSize: 11 },
	main: { position: "absolute", inset: "135px 100px 190px", display: "flex", alignItems: "center", justifyContent: "center" },
	eyebrow: { margin: "0 0 24px", color: "#c9ef74", fontSize: 15, letterSpacing: 4 },
	title: { margin: 0, fontFamily: "Georgia, serif", fontSize: 92, lineHeight: 1.06, fontWeight: 400 },
	subtitle: { margin: "25px 0 0", color: "#bdc4b8", fontSize: 28 },
	codeWindow: { width: "100%", maxWidth: 1080, height: "100%", maxHeight: "100%", boxSizing: "border-box", overflow: "hidden", display: "flex", flexDirection: "column", padding: "16px 20px", border: "1px solid #ffffff25", borderRadius: 12, backgroundColor: "#202720" },
	codeHeader: { display: "flex", alignItems: "center", gap: 20, paddingBottom: 17, color: "#a9b39f", fontSize: 12, letterSpacing: 2 },
	codeViewport: { flex: 1, minHeight: 0, overflow: "hidden" },
	windowDots: { color: "#d98263", letterSpacing: 4 },
	codeBlock: { margin: 0, fontFamily: "Consolas, monospace", lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" },
	codeLine: { minHeight: 0, padding: "2px 8px", borderRadius: 4, whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" },
	lineNumber: { display: "inline-block", width: 48, color: "#788276", fontSize: 15, verticalAlign: "top" },
	outputWindow: { width: 820, padding: 38, border: "1px solid #ffffff25", borderRadius: 12, backgroundColor: "#202720" },
	outputText: { margin: 0, color: "#d8ff8a", fontFamily: "Consolas, monospace", fontSize: 42, lineHeight: 1.5 },
	outputResult: { margin: "25px 0 0", color: "#c5cabe", fontSize: 21 },
	stackList: { display: "flex", flexDirection: "column", gap: 12 },
	stackFrame: { display: "grid", gridTemplateColumns: "135px 1fr 1fr auto", alignItems: "center", gap: 16, padding: "16px 20px", border: "1px solid", borderRadius: 8, backgroundColor: "#202720" },
	stackCall: { color: "#f3f1e7", fontFamily: "Consolas, monospace", fontSize: 23 },
	stackVars: { color: "#bdc4b8", fontFamily: "Consolas, monospace", fontSize: 18 },
	stackReturn: { color: "#c9ef74", fontSize: 16 },
	arrayRow: { display: "flex", gap: 15, marginTop: 30 },
	arrayCell: { display: "flex", width: 130, height: 130, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, border: "2px solid", borderRadius: 10, backgroundColor: "#202720", fontSize: 25 },
	recapTitle: { margin: "0 0 34px", fontFamily: "Georgia, serif", fontSize: 54, fontWeight: 400 },
	recapList: { display: "grid", gap: 18, margin: 0, padding: 0, listStyle: "none", color: "#e6e9e0", fontSize: 26 },
	recapNumber: { display: "inline-block", width: 60, color: "#c9ef74", fontFamily: "Consolas, monospace", fontSize: 17 },
	footer: { position: "absolute", right: 58, bottom: 34, left: 58, display: "flex", alignItems: "center", gap: 16, padding: "18px 22px", border: "1px solid #ffffff20", borderRadius: 8, backgroundColor: "#101410ef" },
	captionMark: { width: 3, height: 38, flex: "0 0 auto", backgroundColor: "#d98263" },
	caption: { flex: 1, margin: 0, color: "#e4e8df", fontSize: 21, lineHeight: 1.4 },
	activeCaptionWord: { color: "#d8ff8a", backgroundColor: "#c9ef7430", borderRadius: 3 },
	sceneCount: { flex: "0 0 auto", color: "#8e998a", fontFamily: "Consolas, monospace", fontSize: 14 },
};
