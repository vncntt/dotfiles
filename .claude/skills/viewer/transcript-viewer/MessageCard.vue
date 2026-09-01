<script setup lang="ts">
import { ref, computed } from "vue";
import type { Msg } from "../types";
import { fmtTime, fmtTokens, fmtDuration } from "../lib/format";
import { useVisible } from "../lib/useVisible";
import Markdown from "./Markdown.vue";
import ToolBlock from "./ToolBlock.vue";

const props = defineProps<{
  msg: Msg;
  /** which agent this message belongs to (colors + badge in timeline) */
  src?: "researcher" | "coder";
  showSrc?: boolean;
  anchorPrefix?: string;
}>();

const root = ref<Element | null>(null);
const visible = useVisible(root);

const anchorId = computed(() => `${props.anchorPrefix ?? "m"}-${props.msg.i}`);

const roleLabel = computed(() => {
  if (props.msg.role === "event") return props.msg.kind ?? "event";
  return props.msg.role;
});

const isEvent = computed(() => props.msg.role === "event");
const isSessionEnd = computed(() => props.msg.kind === "session_end");
const sessionEndOpen = ref(false);

const eventText = computed(() => props.msg.blocks[0]?.text ?? "");
</script>

<template>
  <!-- compact one-line events (session boundaries, task notifications, retries) -->
  <div v-if="isEvent && !isSessionEnd" ref="root" :id="anchorId" class="event-row" :class="`ev-${msg.kind}`">
    <span class="ev-badge" :class="src && showSrc ? `src-${src}` : ''">{{ showSrc && src ? src + " · " : "" }}{{ roleLabel }}</span>
    <span class="ev-text">{{ eventText }}</span>
    <span class="ev-ts">{{ fmtTime(msg.ts) }}{{ msg.tsApprox ? "~" : "" }}</span>
  </div>

  <!-- session end: collapsible summary card -->
  <div v-else-if="isSessionEnd" ref="root" :id="anchorId" class="session-end" :class="src && showSrc ? `border-${src}` : ''">
    <button class="se-head" @click="sessionEndOpen = !sessionEndOpen">
      <span class="ev-badge">{{ showSrc && src ? src + " · " : "" }}session result</span>
      <span class="se-meta">{{ msg.numTurns }} turns · {{ fmtDuration(msg.durationMs) }}</span>
      <span class="se-preview" v-if="!sessionEndOpen">{{ eventText.replace(/\s+/g, " ").slice(0, 110) }}</span>
      <span class="ev-ts">{{ fmtTime(msg.ts) }}{{ msg.tsApprox ? "~" : "" }}</span>
    </button>
    <div v-if="sessionEndOpen" class="se-body">
      <Markdown v-if="visible" :src="eventText" />
      <pre v-else class="plain">{{ eventText }}</pre>
    </div>
  </div>

  <!-- regular message -->
  <article v-else ref="root" :id="anchorId" class="msg" :class="[`role-${msg.role}`, src ? `src-border-${src}` : '']">
    <header class="msg-head">
      <a class="msg-index" :href="`#${anchorId}`" :title="`message ${msg.i}`">#{{ msg.i }}</a>
      <span class="msg-role" :class="showSrc && src ? `src-${src}` : ''">
        {{ showSrc && src ? `${src} · ` : "" }}{{ roleLabel }}
      </span>
      <span class="msg-spacer"></span>
      <span v-if="msg.usage" class="msg-tokens" :title="`${msg.usage.in} in / ${msg.usage.out} out`">
        {{ fmtTokens(msg.usage.in) }} → {{ fmtTokens(msg.usage.out) }}
      </span>
      <span class="msg-ts">{{ fmtTime(msg.ts) }}{{ msg.tsApprox ? "~" : "" }}</span>
    </header>
    <div class="msg-body">
      <template v-for="(b, bi) in msg.blocks" :key="bi">
        <div v-if="b.t === 'thinking'" class="thinking">
          <Markdown v-if="visible" :src="b.text ?? ''" />
          <pre v-else class="plain">{{ b.text }}</pre>
        </div>
        <div v-else-if="b.t === 'text'" class="text-block">
          <Markdown v-if="visible" :src="b.text ?? ''" />
          <pre v-else class="plain">{{ b.text }}</pre>
        </div>
        <ToolBlock v-else-if="b.t === 'tool'" :block="b" />
      </template>
    </div>
  </article>
</template>

<style scoped>
.msg {
  border: 1px solid var(--border);
  border-radius: 8px;
  margin: 10px 0;
  background: #fff;
  content-visibility: auto;
  contain-intrinsic-size: auto 120px;
}
.role-assistant {
  border-left: 3px solid var(--border-strong);
}
.role-user {
  border-left: 3px solid #f0c36c;
  background: #fffdf7;
}
.src-border-researcher.role-assistant {
  border-left-color: var(--researcher);
}
.src-border-coder.role-assistant {
  border-left-color: var(--coder);
}
.msg-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 5px 12px;
  border-bottom: 1px solid var(--bg-hover);
  font-size: 11.5px;
  color: var(--fg-faint);
}
.msg-index {
  font-family: var(--mono);
  color: var(--fg-faint);
  text-decoration: none;
}
.msg-index:hover {
  color: var(--accent);
}
.msg-role {
  font-weight: 650;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 10.5px;
}
.msg-spacer {
  flex: 1;
}
.msg-tokens {
  font-family: var(--mono);
}
.msg-ts {
  font-variant-numeric: tabular-nums;
}
.msg-body {
  padding: 10px 14px;
}
.thinking {
  color: #7a7f8a;
  font-style: italic;
  font-size: 13px;
  border-left: 2px dotted var(--border-strong);
  padding-left: 10px;
  margin: 6px 0;
}
.text-block {
  margin: 6px 0;
}
.plain {
  margin: 0;
  font-family: inherit;
  font-size: inherit;
  white-space: pre-wrap;
  word-break: break-word;
}
.src-researcher {
  color: var(--researcher);
}
.src-coder {
  color: var(--coder);
}

/* events */
.event-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 12px;
  margin: 4px 0;
  font-size: 12px;
  color: var(--fg-muted);
  content-visibility: auto;
  contain-intrinsic-size: auto 26px;
}
.ev-session_start {
  border-top: 1px dashed var(--border-strong);
  padding-top: 8px;
  margin-top: 14px;
  color: var(--fg);
  font-weight: 600;
}
.ev-api_retry {
  color: var(--error);
}
.ev-badge {
  flex: none;
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 650;
  color: var(--fg-faint);
}
.ev-text {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ev-ts {
  flex: none;
  font-size: 11px;
  color: var(--fg-faint);
  font-variant-numeric: tabular-nums;
}
.session-end {
  border: 1px solid var(--border);
  border-radius: 8px;
  margin: 10px 0;
  background: var(--bg-subtle);
  content-visibility: auto;
  contain-intrinsic-size: auto 40px;
}
.se-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  width: 100%;
  padding: 6px 12px;
  background: none;
  border: none;
  text-align: left;
  font-size: 12px;
  color: var(--fg-muted);
}
.se-head:hover {
  background: var(--bg-hover);
}
.se-meta {
  flex: none;
  font-weight: 600;
}
.se-preview {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--fg-faint);
}
.se-body {
  border-top: 1px solid var(--border);
  padding: 10px 14px;
  background: #fff;
  border-radius: 0 0 8px 8px;
}
</style>
