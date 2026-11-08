/**
 * Short, specific sidebar labels for lesson scenes ("Line 3 · Loop over nums" instead of five
 * "Walk through the code" in a row). Works from the scene's own content, for any language.
 */
import type { Scene } from "@/lib/schema";

const MAX = 34;
const clip = (text: string, max = MAX) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Drop a closing ")" that belongs to the surrounding for (...), keep the ones that belong to calls like range(n). */
const balance = (t: string) => {
  const extra = (t.match(/\)/g)?.length ?? 0) - (t.match(/\(/g)?.length ?? 0);
  return extra > 0 ? t.replace(/\)\s*$/, "") : t;
};

/** "Print \"Value of x\"" / "Print result": what a print line shows. */
function describePrint(line: string): string {
  const text = line.match(/(["'`])((?:(?!\1).)+)\1/)?.[2];
  if (text) {
    const words = text.replace(/%[-\d.]*[a-z]|\{[^}]*\}|\$\{[^}]*\}|\\n/g, "").replace(/[:=\s]+$/, "").trim();
    if (words) return `Print "${words}"`;
  }
  const arg = line.match(/\(\s*([^()]+(?:\([^()]*\))?[^()]*)\)/)?.[1] ?? line.split("<<")[1];
  return arg ? `Print ${arg.trim()}` : "Print the result";
}

/** What one line of code does, in a few words. */
function describeLine(raw: string): string {
  const line = raw.trim().replace(/;\s*$/, "").replace(/\s*\{\s*$/, "").replace(/:\s*$/, "");
  let m: RegExpMatchArray | null;
  if ((m = line.match(/^#include\s*[<"]([^>"]+)/))) return `Include ${m[1]}`;
  if ((m = line.match(/^(?:from\s+(\S+)\s+)?import\s+(.+)/))) return `Import ${m[1] ?? m[2].split(/[\s,]/)[0]}`;
  if (/^(print|console\.log|printf|puts|System\.out\.print(?:ln|f)?|std::cout|cout)\b/.test(line)) return describePrint(line);
  if ((m = line.match(/^for\s+(.+?)\s+in\s+(.+)/))) return `Loop over ${balance(m[2])}`;
  if ((m = line.match(/^for\s*\((?:const|let|var|int|auto)?\s*&?\s*(\w+)\s*(?:of|in|:)\s*(.+?)\)?$/))) return `Loop over ${balance(m[2])}`;
  if ((m = line.match(/^for\s*\(\s*(?:int|let|var|auto)?\s*(\w+)/))) return `Loop with ${m[1]}`;
  if ((m = line.match(/^while\s*\(?(.+?)\)?$/))) return `While ${m[1]}`;
  if ((m = line.match(/^(?:if|elif|else\s+if)\s*\(?(.+?)\)?$/))) return `Check ${m[1]}`;
  if (/^(else|\}\s*else)$/.test(line)) return "Otherwise";
  if ((m = line.match(/^return\s*(.*)/))) return m[1] ? `Return ${m[1]}` : "Return";
  if ((m = line.match(/^(?:export\s+)?(?:async\s+)?(?:def|function)\s+(\w+)/))) return `Define ${m[1]}()`;
  if ((m = line.match(/^(?:public|private|protected)?\s*class\s+(\w+)/))) return `Define class ${m[1]}`;
  if ((m = line.match(/^(?:public\s+|private\s+|static\s+)*(?:[\w<>[\]:*]+\s+)+(\w+)\s*\([^)]*\)$/))) return `Define ${m[1]}()`;
  if ((m = line.match(/^(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/))) return `Define ${m[1]}()`;
  if ((m = line.match(/^(?:const|let|var|int|long|double|float|char|bool|boolean|string|auto|std::\w+(?:<[^>]*>)?)\s+\*?(\w+)\s*=/))) return `Set ${m[1]}`;
  if ((m = line.match(/^(?:const\s+)?(?:std::)?[\w:]+(?:<[^>]*>)?\s+\*?(\w+)$/))) return `Create ${m[1]}`;
  if ((m = line.match(/^([\w.[\]]+)\s*([-+*/%]?=)(?!=)/))) return m[2] === "=" ? `Set ${m[1]}` : `Update ${m[1]}`;
  if ((m = line.match(/^(?:await\s+)?([\w.]+)\s*\(/))) return `Call ${m[1]}()`;
  return line;
}

export function sceneLabel(scene: Scene): string {
  switch (scene.type) {
    case "title":
      return "Get the big picture";
    case "code": {
      const lines = scene.code.split("\n");
      const first = scene.highlightLines[0];
      if (!first || !lines[first - 1]?.trim()) return "Walk through the code";
      const where = scene.highlightLines.length > 1 ? `Lines ${first}–${scene.highlightLines.at(-1)}` : `Line ${first}`;
      return clip(`${where} · ${describeLine(lines[first - 1])}`);
    }
    case "diagram": {
      const d = scene.diagram;
      if (d.kind === "callstack") {
        const top = d.frames.at(-1);
        const returned = d.frames.filter((f) => f.returns !== undefined).length;
        if (!top) return "The call stack";
        if (returned === 0) return clip(`Stack grows to ${top.call}`);
        if (returned < d.frames.length) {
          const last = d.frames[d.frames.length - returned]; // the most recent call to finish
          return clip(`${last.call} returns ${last.returns}`);
        }
        return clip(`Stack unwinds to ${d.frames[0].returns}`);
      }
      const list = `[${d.values.join(", ")}]`;
      if (d.pointers.length) return clip(`${d.pointers.map((p) => `${p.label} → ${d.values[p.index]}`).join(", ")} · ${list}`);
      if (d.highlight.length === 2) return clip(`Compare ${d.values[d.highlight[0]]} and ${d.values[d.highlight[1]]}`);
      if (d.highlight.length === 1) return clip(`Look at ${d.values[d.highlight[0]]} in ${list}`);
      return clip(`List: ${list}`);
    }
    case "output":
      return clip(`Output: ${scene.output.split("\n")[0]}${scene.output.includes("\n") ? " …" : ""}`);
    case "recap":
      return "Key takeaways";
  }
}
