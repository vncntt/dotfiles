# Transcript viewer (use case of /viewer)

Proven design for viewing agent transcripts in the Claude Code / Agent SDK session-stream JSONL format (one JSON object per line). Built as `dcl-viewer` (pzero-trial); handles runs up to ~4,700 messages loading in ~0.5s. The files in this folder are the working implementation — copy and adapt them rather than rewriting from scratch.

## Files

- `preprocess.ts` — Bun script: raw transcript JSONL → compact `Transcript { model, messages: Msg[] }` JSON. Contains the tolerant JSONL reader, tool pairing, event normalization, timestamp carry-forward, tool summaries. The DCL-specific parts (run.json, experiments, OVERVIEW.md parsing) are at the bottom — replace those; keep `parseTranscript`.
- `types.ts` — `Msg` / `Block` schema shared between preprocessor and app.
- `TranscriptView.vue` — transcript pane: sticky header bar (who/model/message count/output tokens), search with prev/next + "only matches" + jump-to-#, renders MessageCards.
- `MessageCard.vue` — one message: header (`#index` anchor link, role, tokens `1.2M → 3.4k`, timestamp with `~` for approximate), body blocks; compact one-line rows for events; collapsible card for session_end. Has the `content-visibility` + lazy-markdown wiring.
- `ToolBlock.vue` — collapsed tool call (caret, name, one-line summary, error badge) → expands to shiki-highlighted input (bash `command` highlighted as bash, otherwise JSON) + plain-mono result with 4,000-char preview / "show all (N kB)" / 480px max-height scroll / red tint on error.
- `Markdown.vue` — trivial `v-html` wrapper over `renderMarkdown` (see `../references/markdown.ts`).

## Input format (Claude Code / Agent SDK session JSONL)

Each line: `{ type, timestamp?, message?, ... }` where `type` is `user | assistant | system | result`.

- `assistant`: `message.content` is an array of `{type: "text"}`, `{type: "thinking"}`, `{type: "tool_use", id, name, input}` blocks; `message.usage` has token counts; `message.model` (skip `"<synthetic>"`).
- `user`: `message.content` is a string OR an array containing `{type: "tool_result", tool_use_id, content, is_error}` and/or text blocks.
- `system` subtypes: `init` (has `model`), `compact_boundary`, `api_retry`, `task_started/task_notification/task_updated`, `status`, `thinking_tokens` (skip).
- `result`: session end; has `duration_ms`, `num_turns`, `result` text.
- Session files in `~/.claude/projects/<slug>/<session-id>.jsonl` additionally have sidecar types (`mode`, `custom-title`, `file-history-snapshot`, …— ignore) and subagent transcripts in `<session-id>/subagents/agent-<id>.jsonl` with `agent-<id>.meta.json` (`agentType`, `description`, `spawnDepth`, `model`).

## Normalized schema

```
Msg   { i, role: "user"|"assistant"|"event", kind?, ts, tsApprox?, usage?: {in, out}, durationMs?, numTurns?, blocks: Block[] }
Block { t: "text"|"thinking"|"tool", text?, name?, input?, summary?, result?, isError? }
```

## Parsing rules (all implemented in `preprocess.ts`)

- **Tolerant reader**: try/catch per line, skip non-JSON.
- **Tool pairing**: keep `Map<tool_use_id, Block>`; when a `tool_result` arrives, attach its stringified content to the originating tool block (`result`, `isError`) so call + result render as ONE unit. Orphan results become standalone tool blocks. User messages that were purely tool_results disappear as separate messages — this is correct.
- **Events**: system/result records become one-line `role: "event"` messages (`session_start` with model, `compact`, `api_retry`, `task`/`status`); `result` → collapsible `session_end` card with turns + duration.
- **Timestamps**: carry the last seen timestamp forward for records lacking one; set `tsApprox: true`, render with `~` suffix.
- **Usage**: `in = input_tokens + cache_read_input_tokens + cache_creation_input_tokens`, `out = output_tokens`. Model captured once (first real assistant model), shown once in the transcript header bar — NOT per message (explicit user preference).
- **Tool summary**: first of `input.command ?? file_path ?? path ?? pattern ?? query ?? url ?? skill ?? description ?? prompt`, whitespace-collapsed, ≤120 chars.
- **Never truncate at preprocess time** — full results go in the JSON; the UI previews.
- Mining structured data out of tool_results (e.g. per-experiment GPU hours from harness API responses): JSON-parse the result content and walk it — string-grepping raw JSONL misses escaped quotes.

## UI conventions

- Role accents as 3px left borders: assistant = source color (purple researcher / cyan coder), user = amber on cream `#fffdf7`; thinking = muted gray italic with dotted left border, shown inline (not collapsed).
- Search: lowercase corpus precomputed per message (text+name+input+result), min 2 chars, `n/m` counter, ↑/↓, "only matches", jump-to-#; amber border on hits, outline on current.
- Multi-transcript runs: one tab per transcript + a merged **Timeline** tab — all transcripts + external events (experiment status changes, scores, questions) sorted by epoch ts (fallback = run start), with checkbox filters for each source / tools / thinking / events, and colored source badges on each card.
- **Windowing for analysis**: when slicing a transcript into windows (e.g. "messages between experiment N-1 and N"), cut by TIMESTAMP against event times, not by string-matching content — content patterns differ across models and drift; line offsets drift too. Write self-contained per-window files if subagents will read them.
