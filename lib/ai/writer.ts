/** Step 2: Writer — turns the plan into a full lesson draft (scenes + narration + diagram data). */
import { chat, type ChatMessage } from "./llm";
import { WRITER_SYSTEM, writerRetryUser, writerUser } from "./prompts";
import type { Plan } from "./planner";
import type { LessonRequest } from "./request";

/**
 * Keeps the conversation so a retry can say "here's what was wrong with your last answer"
 * instead of starting over (cheaper and converges faster).
 */
export class Writer {
  private messages: ChatMessage[];

  constructor(req: LessonRequest, plan: Plan) {
    this.messages = [
      { role: "system", content: WRITER_SYSTEM },
      { role: "user", content: writerUser({ req, plan: { title: plan.title, summary: plan.summary, chapters: plan.chapters }, mainCode: plan.mainCode }) },
    ];
  }

  /** First draft. Returns the raw model text. */
  async draft(): Promise<string> {
    return this.send(0.5);
  }

  /** Ask the model to fix specific problems in its previous answer. */
  async revise(previous: string, issues: string[]): Promise<string> {
    this.messages.push({ role: "assistant", content: previous });
    this.messages.push({ role: "user", content: writerRetryUser(issues) });
    return this.send(0.2);
  }

  private send(temperature: number) {
    return chat({ messages: this.messages, temperature, maxTokens: 2500, timeoutMs: 240_000 });
  }
}
