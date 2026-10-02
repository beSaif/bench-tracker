import "server-only"
import { ChatMessage } from "./planPrompt"

/**
 * The model behind Dot's planner, reached over the OpenAI-compatible chat API that
 * Groq, OpenRouter, Cloudflare Workers AI and most other hosts speak, so moving to
 * another free tier is a matter of environment variables:
 *
 * - `PLANNER_API_KEY`: required. Without it the planner is off and only the
 *   copy-and-paste path is offered.
 * - `PLANNER_BASE_URL`: defaults to Groq.
 * - `PLANNER_MODEL`: defaults to gpt-oss-120b on Groq.
 *
 * Only the routine and the answers to Dot's questions are ever sent: no email, name,
 * bodyweight or sessions.
 */

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"
const DEFAULT_MODEL = "openai/gpt-oss-120b"
const TIMEOUT_MS = 40_000
/** Reasoning models spend part of this before the answer starts; a full routine is ~1.5k. */
const MAX_TOKENS = 6000

export function plannerConfigured(): boolean {
  return !!process.env.PLANNER_API_KEY
}

export type CompletionResult =
  | { ok: true; text: string }
  /** `busy`: the host's rate limit, worth trying again later. `failed`: anything else. */
  | { ok: false; reason: "busy" | "failed" }

export async function completeJson(messages: ChatMessage[]): Promise<CompletionResult> {
  const key = process.env.PLANNER_API_KEY
  if (!key) return { ok: false, reason: "failed" }
  const base = (process.env.PLANNER_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "")

  let res: Response
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.PLANNER_MODEL || DEFAULT_MODEL,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: MAX_TOKENS,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return { ok: false, reason: "failed" }
  }

  if (res.status === 429) return { ok: false, reason: "busy" }
  if (!res.ok) {
    console.error("planner: host answered", res.status, (await res.text().catch(() => "")).slice(0, 500))
    return { ok: false, reason: res.status >= 500 ? "busy" : "failed" }
  }
  const data = await res.json().catch(() => null)
  const text = data?.choices?.[0]?.message?.content
  return typeof text === "string" && text.trim() ? { ok: true, text } : { ok: false, reason: "failed" }
}
