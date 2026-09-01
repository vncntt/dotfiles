export function fmtNum(v: number | null | undefined, digits = 4): string {
  return v == null ? "—" : v.toFixed(digits);
}

export function fmtMoney(v: number | null | undefined): string {
  return v == null ? "—" : `$${v.toFixed(2)}`;
}

export function fmtHours(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(1)}h`;
}

export function fmtTime(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function fmtClock(ts: string | null | undefined): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return "";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function fmtTokens(n: number | null | undefined): string {
  if (n == null) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function shortModel(m: string): string {
  return m
    .replace(/^openrouter\//, "")
    .replace(/^openai\//, "")
    .replace(/^moonshotai\//, "")
    .replace(/-\d{8}$/, "");
}

/** "2025-03-08-000009-final-16700" -> "final-16700" (date + counter prefix repeat across experiments) */
export function shortExpName(displayId: string): string {
  return displayId.replace(/^\d{4}-\d{2}-\d{2}-\d+-/, "");
}

const PALETTE =["#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2", "#be185d", "#4d7c0f"];
const modelColors = new Map<string, string>();

export function modelColor(model: string): string {
  const key = shortModel(model);
  if (!modelColors.has(key)) modelColors.set(key, PALETTE[modelColors.size % PALETTE.length]);
  return modelColors.get(key)!;
}
