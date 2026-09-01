<script setup lang="ts">
import { computed } from "vue";
import { renderMarkdown } from "../lib/markdown";

const props = defineProps<{ src: string; assetBase?: string }>();
const html = computed(() => renderMarkdown(props.src ?? "", props.assetBase));
</script>

<template>
  <div class="md" v-html="html"></div>
</template>
