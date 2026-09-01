export interface Block {
  t: "text" | "thinking" | "tool";
  text?: string;
  name?: string;
  input?: string;
  summary?: string;
  result?: string;
  isError?: boolean;
}

export interface Msg {
  i: number;
  role: "user" | "assistant" | "event";
  kind?: string;
  ts: string | null;
  tsApprox?: boolean;
  usage?: { in: number; out: number };
  durationMs?: number;
  numTurns?: number;
  blocks: Block[];
}

export interface Transcript {
  model: string | null;
  messages: Msg[];
}

export interface Submission {
  created: string;
  val: number | null;
  test: number | null;
  val_metadata?: Record<string, number>;
  test_metadata?: Record<string, number>;
  scoring_error?: string;
  is_official?: boolean;
}

export interface Experiment {
  number: number;
  displayId: string;
  created: string;
  prompt: string;
  status: string;
  updates: { time: string; status: string; message: string }[];
  submissions: Submission[];
  val: number | null;
  test: number | null;
  gpuHours: number | null;
  spec: string;
  report: string;
  scores: unknown;
  assets: string[];
}

export interface LiaisonQ {
  origin: string;
  status: string;
  question: string;
  answer: string;
  created: string;
  asked_at: string;
  answered_at: string;
}

export interface RunMeta {
  id: string;
  runId: number;
  created: string;
  tags: Record<string, string>;
  outcome: Record<string, number | null>;
  questions: LiaisonQ[];
  experiments: Experiment[];
}

export interface RunSummary {
  id: string;
  runId: number;
  created: string;
  task: string;
  researcherModel: string;
  coderModel: string;
  coderEffort: string;
  gpuBudgetHours: number | null;
  wallClockBudgetHours: number | null;
  lowerIsBetter: boolean;
  numExperiments: number;
  numQuestions: number;
  bestVal: number | null;
  officialVal: number | null;
  officialTest: number | null;
  gpuHours: number | null;
  wallClockHours: number | null;
  researcherCost: number | null;
  coderCost: number | null;
  researcherMessages: number;
  coderMessages: number;
}

export interface RunIndex {
  generated: string;
  runs: RunSummary[];
}
