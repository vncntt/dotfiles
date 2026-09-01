<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { loadTranscript } from "../lib/data";
import type { Transcript } from "../types";
import { fmtTokens, shortModel } from "../lib/format";
import MessageCard from "./MessageCard.vue";

const props = defineProps<{ runId: string; who: "researcher" | "coder" }>();

const transcript = ref<Transcript | null>(null);
const error = ref("");
const query = ref("");
const onlyMatches = ref(false);
const currentHit = ref(0);
const jumpTo = ref("");

onMounted(load);
watch(() => [props.runId, props.who], load);

async function load() {
  transcript.value = null;
  error.value = "";
  try {
    transcript.value = await loadTranscript(props.runId, props.who);
  } catch (e) {
    error.value = String(e);
  }
}

const messages = computed(() => transcript.value?.messages ?? []);

const totalTokens = computed(() => {
  let out = 0;
  for (const m of messages.value) if (m.usage) out += m.usage.out;
  return out;
});

// lowercase searchable corpus, built once per transcript
const corpus = computed(() =>
  messages.value.map((m) =>
    m.blocks
      .map((b) => `${b.text ?? ""}\n${b.name ?? ""}\n${b.input ?? ""}\n${b.result ?? ""}`)
      .join("\n")
      .toLowerCase()
  )
);

const hits = computed<number[]>(() => {
  const q = query.value.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: number[] = [];
  corpus.value.forEach((text, i) => {
    if (text.includes(q)) out.push(i);
  });
  return out;
});

watch(hits, () => (currentHit.value = 0));

const hitSet = computed(() => new Set(hits.value));

const shown = computed(() => {
  if (onlyMatches.value && query.value.trim().length >= 2) return messages.value.filter((m) => hitSet.value.has(m.i));
  return messages.value;
});

function scrollToMsg(i: number) {
  document.getElementById(`${props.who[0]}-${i}`)?.scrollIntoView({ block: "center" });
}

function gotoHit(delta: number) {
  if (!hits.value.length) return;
  currentHit.value = (currentHit.value + delta + hits.value.length) % hits.value.length;
  nextTick(() => scrollToMsg(hits.value[currentHit.value]));
}

function jump() {
  const n = parseInt(jumpTo.value, 10);
  if (!isNaN(n)) {
    onlyMatches.value = false;
    nextTick(() => scrollToMsg(n));
  }
}
</script>

<template>
  <div>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="!transcript" class="loading">loading transcript…</p>
    <template v-else>
      <div class="transcript-bar" :class="`bar-${who}`">
        <span class="tb-title">{{ who }}</span>
        <span class="tb-model" v-if="transcript.model">{{ shortModel(transcript.model) }}</span>
        <span class="tb-stat">{{ messages.length }} messages</span>
        <span class="tb-stat" v-if="totalTokens">{{ fmtTokens(totalTokens) }} output tokens</span>
        <span class="tb-spacer"></span>
        <input v-model="jumpTo" class="tb-jump" type="text" placeholder="#" @keydown.enter="jump" title="jump to message #" />
        <input v-model="query" class="tb-search" type="search" placeholder="search transcript…" @keydown.enter="gotoHit(1)" />
        <template v-if="query.trim().length >= 2">
          <span class="tb-hits">{{ hits.length ? `${currentHit + 1}/${hits.length}` : "0" }}</span>
          <button class="tb-btn" @click="gotoHit(-1)" :disabled="!hits.length">↑</button>
          <button class="tb-btn" @click="gotoHit(1)" :disabled="!hits.length">↓</button>
          <label class="tb-only"><input type="checkbox" v-model="onlyMatches" /> only matches</label>
        </template>
      </div>

      <div class="messages">
        <MessageCard
          v-for="m in shown"
          :key="m.i"
          :msg="m"
          :src="who"
          :anchor-prefix="who[0]"
          :class="{
            hit: hitSet.has(m.i) && query.trim().length >= 2,
            'hit-current': hits.length > 0 && hits[currentHit] === m.i,
          }"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.error {
  color: var(--error);
}
.loading {
  color: var(--fg-muted);
}
.transcript-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-subtle);
  position: sticky;
  top: 46px;
  z-index: 10;
  font-size: 12.5px;
  color: var(--fg-muted);
  flex-wrap: wrap;
}
.bar-researcher {
  border-left: 3px solid var(--researcher);
}
.bar-coder {
  border-left: 3px solid var(--coder);
}
.tb-title {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 11px;
  color: var(--fg);
}
.tb-model {
  font-family: var(--mono);
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 1px 7px;
}
.tb-spacer {
  flex: 1;
}
.tb-search {
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  padding: 3px 9px;
  width: 210px;
  font-size: 12.5px;
}
.tb-jump {
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  padding: 3px 6px;
  width: 52px;
  font-size: 12.5px;
  font-family: var(--mono);
}
.tb-hits {
  font-variant-numeric: tabular-nums;
}
.tb-btn {
  border: 1px solid var(--border-strong);
  background: #fff;
  border-radius: 5px;
  padding: 1px 8px;
}
.tb-btn:disabled {
  opacity: 0.4;
}
.tb-only {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}
.messages {
  margin-top: 10px;
}
.messages :deep(.hit) {
  border-left-width: 3px;
  border-left-color: #f59e0b;
}
.messages :deep(.hit-current) {
  outline: 2px solid #f59e0b;
}
</style>
