<script setup lang="ts">
import { ref, computed } from "vue";
import type { Block } from "../types";
import { highlightCode } from "../lib/markdown";

const props = defineProps<{ block: Block }>();
const open = ref(false);
const showFull = ref(false);

const PREVIEW = 4000;

const inputHtml = computed(() => {
  if (!open.value || !props.block.input) return "";
  const input = props.block.input;
  // bash-like tools: show the command highlighted as bash instead of raw JSON
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed.command === "string" && (props.block.name ?? "").toLowerCase() === "bash") {
      return highlightCode(parsed.command, "bash");
    }
  } catch {
    /* not JSON */
  }
  return highlightCode(input, "json");
});

const result = computed(() => props.block.result ?? "");
const resultShown = computed(() => (showFull.value || result.value.length <= PREVIEW ? result.value : result.value.slice(0, PREVIEW)));
const truncated = computed(() => !showFull.value && result.value.length > PREVIEW);
</script>

<template>
  <div class="tool" :class="{ 'tool-error': block.isError }">
    <button class="tool-head" @click="open = !open">
      <span class="tool-caret">{{ open ? "▾" : "▸" }}</span>
      <span class="tool-name">{{ block.name }}</span>
      <span class="tool-summary">{{ block.summary }}</span>
      <span v-if="block.isError" class="tool-err-badge">error</span>
    </button>
    <div v-if="open" class="tool-body">
      <div v-if="block.input" class="tool-section">
        <div class="tool-label">input</div>
        <div class="tool-code" v-html="inputHtml"></div>
      </div>
      <div v-if="block.result !== undefined" class="tool-section">
        <div class="tool-label">result{{ block.result ? ` · ${(block.result.length / 1000).toFixed(1)}kB` : "" }}</div>
        <pre class="tool-result">{{ resultShown }}</pre>
        <button v-if="truncated" class="show-all" @click="showFull = true">show all ({{ Math.round(result.length / 1000) }} kB)</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool {
  border: 1px solid var(--border);
  border-radius: 6px;
  margin: 6px 0;
  background: var(--bg-subtle);
  overflow: hidden;
}
.tool-error {
  border-color: #fca5a5;
}
.tool-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 5px 10px;
  background: none;
  border: none;
  text-align: left;
  font-size: 12.5px;
  color: var(--fg-muted);
}
.tool-head:hover {
  background: var(--bg-hover);
}
.tool-caret {
  color: var(--fg-faint);
  flex: none;
  font-size: 10px;
}
.tool-name {
  font-family: var(--mono);
  font-weight: 600;
  color: var(--fg);
  flex: none;
}
.tool-summary {
  font-family: var(--mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.tool-err-badge {
  flex: none;
  color: var(--error);
  background: var(--error-bg);
  border-radius: 4px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
}
.tool-body {
  border-top: 1px solid var(--border);
  padding: 8px 10px;
  background: #fff;
}
.tool-section + .tool-section {
  margin-top: 8px;
}
.tool-label {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-faint);
  margin-bottom: 3px;
}
.tool-code :deep(pre) {
  margin: 0;
  padding: 8px 10px;
  border-radius: 5px;
  border: 1px solid var(--border);
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.45;
  background: var(--bg-subtle) !important;
}
.tool-result {
  margin: 0;
  padding: 8px 10px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 480px;
  overflow: auto;
}
.tool-error .tool-result {
  background: var(--error-bg);
}
.show-all {
  margin-top: 5px;
  border: 1px solid var(--border-strong);
  background: #fff;
  border-radius: 5px;
  padding: 2px 10px;
  font-size: 12px;
  color: var(--fg-muted);
}
.show-all:hover {
  color: var(--accent);
  border-color: var(--accent);
}
</style>
