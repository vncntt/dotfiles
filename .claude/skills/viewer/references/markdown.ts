import MarkdownIt from "markdown-it";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import bash from "@shikijs/langs/bash";
import python from "@shikijs/langs/python";
import json from "@shikijs/langs/json";
import typescript from "@shikijs/langs/typescript";
import javascript from "@shikijs/langs/javascript";
import yaml from "@shikijs/langs/yaml";
import diff from "@shikijs/langs/diff";
import markdown from "@shikijs/langs/markdown";
import githubLight from "@shikijs/themes/github-light";

let highlighter: HighlighterCore | null = null;
let hlPromise: Promise<HighlighterCore> | null = null;

export function ensureHighlighter(): Promise<HighlighterCore> {
  if (!hlPromise) {
    hlPromise = createHighlighterCore({
      themes: [githubLight],
      langs: [bash, python, json, typescript, javascript, yaml, diff, markdown],
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    }).then((h) => {
      highlighter = h;
      return h;
    });
  }
  return hlPromise;
}

function highlight(code: string, lang: string): string {
  if (highlighter && lang && highlighter.getLoadedLanguages().includes(lang)) {
    try {
      return highlighter.codeToHtml(code, { lang, theme: "github-light" });
    } catch {
      /* fall through */
    }
  }
  const esc = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<pre class="shiki"><code>${esc}</code></pre>`;
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  highlight: (code, lang) => highlight(code, lang || "text"),
});

// rewrite relative image srcs against env.assetBase (used for experiment reports)
type RuleArgs = [tokens: any[], idx: number, options: any, env: any, self: any];

const defaultImage = md.renderer.rules.image!;
md.renderer.rules.image = (...[tokens, idx, options, env, self]: RuleArgs) => {
  const token = tokens[idx];
  const src = token.attrGet("src") ?? "";
  if (env?.assetBase && src && !/^([a-z]+:)?\/\//i.test(src) && !src.startsWith("/")) {
    token.attrSet("src", env.assetBase + src);
  }
  return defaultImage(tokens, idx, options, env, self);
};

// open external links in a new tab
const defaultLink = md.renderer.rules.link_open ?? ((...[t, i, o, , s]: RuleArgs) => s.renderToken(t, i, o));
md.renderer.rules.link_open = (...[tokens, idx, options, env, self]: RuleArgs) => {
  tokens[idx].attrSet("target", "_blank");
  tokens[idx].attrSet("rel", "noopener");
  return defaultLink(tokens, idx, options, env, self);
};

export function renderMarkdown(src: string, assetBase?: string): string {
  return md.render(src, { assetBase });
}

export function highlightCode(code: string, lang: string): string {
  return highlight(code, lang);
}
