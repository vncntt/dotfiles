/**
 * Preprocess DCL run directories into static JSON consumed by the viewer.
 *
 * Usage: bun run scripts/preprocess.ts [path-to-runs-dir]
 * Default runs dir: ../dcl-main-runs-2026-07-30/runs
 * Output: public/data/
 */
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync, copyFileSync, statSync, rmSync } from "node:fs";
import { join, resolve, basename } from "node:path";

const RUNS_DIR = resolve(process.argv[2] ?? join(import.meta.dir, "../../dcl-main-runs-2026-07-30/runs"));
const OUT_DIR = join(import.meta.dir, "../public/data");

// ---------- types shared with the app (duplicated in src/types.ts) ----------

interface Block {
  t: "text" | "thinking" | "tool";
  text?: string;
  // tool blocks
  name?: string;
  input?: string; // pretty-printed input
  summary?: string; // one-line summary for collapsed display
  result?: string;
  isError?: boolean;
}

interface Msg {
  i: number;
  role: "user" | "assistant" | "event";
  kind?: string; // for events: session_start | session_end | compact | api_retry | task | status
  ts: string | null;
  tsApprox?: boolean;
  usage?: { in: number; out: number };
  durationMs?: number;
  numTurns?: number;
  blocks: Block[];
}

// ---------------------------------------------------------------------------

function readJsonl(path: string): any[] {
  const out: any[] = [];
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s));
    } catch {
      /* tolerate stray non-JSON lines */
    }
  }
  return out;
}

function normTs(ts: unknown): string | null {
  if (typeof ts !== "string" || !ts) return null;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function stringifyContent(c: unknown): string {
  if (c == null) return "";
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((b) => {
        if (typeof b === "string") return b;
        if (b && typeof b === "object") {
          if (b.type === "text") return b.text ?? "";
          return JSON.stringify(b, null, 1);
        }
        return String(b);
      })
      .join("\n");
  }
  return JSON.stringify(c, null, 1);
}

function toolSummary(name: string, input: any): string {
  if (input && typeof input === "object") {
    const cand =
      input.command ?? input.file_path ?? input.path ?? input.pattern ?? input.query ?? input.url ?? input.skill ?? input.description ?? input.prompt;
    if (typeof cand === "string" && cand.length) {
      const one = cand.replace(/\s+/g, " ").trim();
      return one.length > 120 ? one.slice(0, 117) + "…" : one;
    }
  }
  const s = JSON.stringify(input ?? "");
  return s.length > 120 ? s.slice(0, 117) + "…" : s;
}

function parseTranscript(path: string): { model: string | null; messages: Msg[] } {
  const records = readJsonl(path);
  const messages: Msg[] = [];
  const toolBlocks = new Map<string, Block>(); // tool_use_id -> tool block awaiting result
  let lastTs: string | null = null;
  let model: string | null = null;

  const push = (m: Omit<Msg, "i">) => {
    messages.push({ i: messages.length, ...m });
  };

  for (const r of records) {
    const type = r?.type;
    const ownTs = normTs(r?.timestamp);
    if (ownTs) lastTs = ownTs;

    if (type === "system") {
      const sub = r.subtype;
      if (sub === "thinking_tokens") continue;
      if (sub === "init") {
        if (!model && r.model) model = r.model;
        push({ role: "event", kind: "session_start", ts: lastTs, tsApprox: !ownTs, blocks: [{ t: "text", text: `Session started · ${r.model ?? "?"}` }] });
      } else if (sub === "compact_boundary") {
        push({ role: "event", kind: "compact", ts: lastTs, tsApprox: !ownTs, blocks: [{ t: "text", text: "Context compacted" }] });
      } else if (sub === "api_retry") {
        push({ role: "event", kind: "api_retry", ts: lastTs, tsApprox: !ownTs, blocks: [{ t: "text", text: `API retry${r.error ? `: ${stringifyContent(r.error).slice(0, 200)}` : ""}` }] });
      } else if (sub === "task_started" || sub === "task_notification" || sub === "task_updated" || sub === "status") {
        const text =
          stringifyContent(r.message ?? r.status ?? r.task ?? r.content ?? "")
            .replace(/\s+/g, " ")
            .slice(0, 300) || sub;
        push({ role: "event", kind: sub === "status" ? "status" : "task", ts: lastTs, tsApprox: !ownTs, blocks: [{ t: "text", text: `${sub.replace("_", " ")}: ${text}` }] });
      }
      continue;
    }

    if (type === "result") {
      const text = typeof r.result === "string" ? r.result : stringifyContent(r.result);
      push({
        role: "event",
        kind: "session_end",
        ts: lastTs,
        tsApprox: !ownTs,
        durationMs: r.duration_ms,
        numTurns: r.num_turns,
        blocks: [{ t: "text", text }],
      });
      continue;
    }

    if (type !== "user" && type !== "assistant") continue;
    const msg = r.message ?? {};
    const content = msg.content;

    if (type === "assistant") {
      if (!model && msg.model && msg.model !== "<synthetic>") model = msg.model;
      const blocks: Block[] = [];
      if (Array.isArray(content)) {
        for (const b of content) {
          if (!b || typeof b !== "object") continue;
          if (b.type === "text" && b.text?.trim()) blocks.push({ t: "text", text: b.text });
          else if (b.type === "thinking" && b.thinking?.trim()) blocks.push({ t: "thinking", text: b.thinking });
          else if (b.type === "tool_use") {
            const tb: Block = {
              t: "tool",
              name: b.name ?? "tool",
              input: JSON.stringify(b.input ?? {}, null, 2),
              summary: toolSummary(b.name ?? "tool", b.input),
            };
            blocks.push(tb);
            if (b.id) toolBlocks.set(b.id, tb);
          }
        }
      } else if (typeof content === "string" && content.trim()) {
        blocks.push({ t: "text", text: content });
      }
      if (!blocks.length) continue;
      const u = msg.usage;
      push({
        role: "assistant",
        ts: lastTs,
        tsApprox: !ownTs,
        usage: u ? { in: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), out: u.output_tokens ?? 0 } : undefined,
        blocks,
      });
      continue;
    }

    // user
    const blocks: Block[] = [];
    if (typeof content === "string") {
      if (content.trim()) blocks.push({ t: "text", text: content });
    } else if (Array.isArray(content)) {
      for (const b of content) {
        if (!b || typeof b !== "object") continue;
        if (b.type === "tool_result") {
          const target = b.tool_use_id ? toolBlocks.get(b.tool_use_id) : undefined;
          const text = stringifyContent(b.content);
          if (target && target.result === undefined) {
            target.result = text;
            if (b.is_error) target.isError = true;
          } else {
            blocks.push({ t: "tool", name: "tool result", input: "", summary: text.replace(/\s+/g, " ").slice(0, 120), result: text, isError: !!b.is_error });
          }
        } else if (b.type === "text" && b.text?.trim()) {
          blocks.push({ t: "text", text: b.text });
        }
      }
    }
    if (blocks.length) push({ role: "user", ts: ownTs ?? lastTs, tsApprox: !ownTs, blocks });
  }

  return { model, messages };
}

/**
 * Per-experiment GPU hours are not in run.json, but the harness API responses
 * captured in transcript tool_results include experiment records with
 * `id` and `result.gpu_hours`. Scan both transcripts and keep the last value per id.
 */
function extractGpuHours(runDir: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const who of ["coder", "researcher"]) {
    for (const r of readJsonl(join(runDir, `${who}_transcript.jsonl`))) {
      const content = r?.message?.content;
      if (!Array.isArray(content)) continue;
      for (const b of content) {
        if (b?.type !== "tool_result" || typeof b.content !== "string" || !b.content.includes("gpu_hours")) continue;
        let obj: unknown;
        try {
          obj = JSON.parse(b.content);
        } catch {
          continue;
        }
        for (const o of Array.isArray(obj) ? obj : [obj]) {
          if (o && typeof o === "object" && typeof (o as any).id === "string" && typeof (o as any).result?.gpu_hours === "number") {
            out.set((o as any).id, (o as any).result.gpu_hours);
          }
        }
      }
    }
  }
  return out;
}

// ---------- OVERVIEW.md outcome parsing ----------

function parseOutcome(overviewPath: string): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  if (!existsSync(overviewPath)) return out;
  const md = readFileSync(overviewPath, "utf8");
  const section = md.split(/^## Outcome$/m)[1]?.split(/^## /m)[0] ?? "";
  const keys: Record<string, string> = {
    Experiments: "experiments",
    "Best val": "bestVal",
    "Official val": "officialVal",
    "Official test": "officialTest",
    "GPU hours used": "gpuHours",
    "Wall-clock hours": "wallClockHours",
    "Researcher cost": "researcherCost",
    "Coder cost": "coderCost",
    "Liaison questions": "questions",
  };
  for (const line of section.split("\n")) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (!m) continue;
    for (const [label, key] of Object.entries(keys)) {
      if (m[1].startsWith(label)) {
        const v = parseFloat(m[2].replace(/[^0-9.\-]/g, ""));
        out[key] = isNaN(v) ? null : v;
      }
    }
  }
  return out;
}

// ---------- main ----------

const ASSET_EXT = new Set([".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp"]);

function processRun(runDir: string) {
  const id = basename(runDir);
  const runJson = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8"));
  const outcome = parseOutcome(join(runDir, "OVERVIEW.md"));
  const outRunDir = join(OUT_DIR, "runs", id);
  mkdirSync(outRunDir, { recursive: true });

  // experiments
  const gpuByExp = extractGpuHours(runDir);
  const expDirs = existsSync(join(runDir, "experiments")) ? readdirSync(join(runDir, "experiments")) : [];
  const experiments = (runJson.experiments ?? []).map((e: any) => {
    const dir = expDirs.find((d) => d === `${String(e.number).padStart(3, "0")}-${e.display_id}`) ?? expDirs.find((d) => d.endsWith(e.display_id));
    let spec = "", report = "", scores: any = null;
    const assets: string[] = [];
    if (dir) {
      const full = join(runDir, "experiments", dir);
      const specPath = join(full, "spec.md");
      if (existsSync(specPath)) spec = readFileSync(specPath, "utf8");
      const scoresPath = join(full, "scores.json");
      if (existsSync(scoresPath)) {
        try { scores = JSON.parse(readFileSync(scoresPath, "utf8")); } catch {}
      }
      const reportDir = join(full, "report");
      if (existsSync(reportDir) && statSync(reportDir).isDirectory()) {
        const idxPath = join(reportDir, "index.md");
        if (existsSync(idxPath)) report = readFileSync(idxPath, "utf8");
        for (const f of readdirSync(reportDir)) {
          const ext = f.slice(f.lastIndexOf(".")).toLowerCase();
          if (ASSET_EXT.has(ext)) {
            const assetOut = join(outRunDir, "exp", String(e.number).padStart(3, "0"));
            mkdirSync(assetOut, { recursive: true });
            copyFileSync(join(reportDir, f), join(assetOut, f));
            assets.push(f);
          }
        }
      }
    }
    const updates = e.updates ?? [];
    const lastStatus = updates.length ? updates[updates.length - 1].status : "unknown";
    const best = (e.submissions ?? []).reduce(
      (acc: any, s: any) => (s.val != null && (acc.val == null || s.val < acc.val) ? s : acc),
      { val: null, test: null }
    );
    return {
      number: e.number,
      displayId: e.display_id,
      created: e.created,
      prompt: e.prompt,
      status: lastStatus,
      updates,
      submissions: e.submissions ?? [],
      val: best.val,
      test: best.test,
      gpuHours: gpuByExp.get(e.display_id) ?? null,
      spec,
      report,
      scores,
      assets,
    };
  });

  const meta = {
    id,
    runId: runJson.run_id,
    created: runJson.created,
    tags: runJson.tags ?? {},
    outcome,
    questions: runJson.questions ?? [],
    experiments,
  };
  writeFileSync(join(outRunDir, "meta.json"), JSON.stringify(meta));

  const researcher = parseTranscript(join(runDir, "researcher_transcript.jsonl"));
  const coder = parseTranscript(join(runDir, "coder_transcript.jsonl"));
  writeFileSync(join(outRunDir, "researcher.json"), JSON.stringify(researcher));
  writeFileSync(join(outRunDir, "coder.json"), JSON.stringify(coder));

  const t = runJson.tags ?? {};
  return {
    id,
    runId: runJson.run_id,
    created: runJson.created,
    task: t.task_display_name ?? t.task ?? "",
    researcherModel: t.researcher_model ?? "",
    coderModel: t.coder_model ?? "",
    coderEffort: t.coder_effort ?? "",
    gpuBudgetHours: parseFloat(t.gpu_budget_hours ?? "") || null,
    wallClockBudgetHours: parseFloat(t.wall_clock_budget_hours ?? "") || null,
    lowerIsBetter: t.lower_is_better === "true",
    numExperiments: experiments.length,
    numQuestions: (runJson.questions ?? []).length,
    bestVal: outcome.bestVal ?? null,
    officialVal: outcome.officialVal ?? null,
    officialTest: outcome.officialTest ?? null,
    gpuHours: outcome.gpuHours ?? null,
    wallClockHours: outcome.wallClockHours ?? null,
    researcherCost: outcome.researcherCost ?? null,
    coderCost: outcome.coderCost ?? null,
    researcherMessages: researcher.messages.length,
    coderMessages: coder.messages.length,
  };
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(join(OUT_DIR, "runs"), { recursive: true });

const runDirs = readdirSync(RUNS_DIR)
  .filter((d) => statSync(join(RUNS_DIR, d)).isDirectory() && existsSync(join(RUNS_DIR, d, "run.json")))
  .sort();

const index = { generated: new Date().toISOString(), runs: [] as any[] };
for (const d of runDirs) {
  console.log("processing", d);
  index.runs.push(processRun(join(RUNS_DIR, d)));
}
index.runs.sort((a, b) => a.runId - b.runId);
writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 1));
console.log(`done: ${index.runs.length} runs -> ${OUT_DIR}`);
