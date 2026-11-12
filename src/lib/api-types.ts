// Request and response shapes for every API route.
// The backend implements these; the UI consumes them. Do not change one side only.

import type {
  AiMode,
  Investor,
  Mandate,
  Mode,
  MonthlyReport,
  Payout,
  Project,
  Purchase,
} from "./types";

/** A project plus figures the UI needs, computed on the server. */
export interface ProjectView extends Project {
  cellsAvailable: number;
  /** 0-100 */
  fundedPct: number;
  targetCents: number;
  raisedCents: number;
  /** Number of distinct owners. */
  ownerCount: number;
  /** Cells the current user owns in this project. */
  yourCells: number;
}

/** GET /api/status */
export interface StatusResponse {
  /** "sandbox" when PayPal sandbox credentials are set, otherwise "demo". */
  paypalMode: Mode;
  /** "live" when an AI key is set, otherwise "demo" (rule-based). */
  aiMode: AiMode;
}

/** GET /api/projects */
export interface ProjectsResponse {
  projects: ProjectView[];
}

/** GET /api/projects/[id] */
export interface ProjectResponse {
  project: ProjectView;
  /** Most recent first. Empty until the project is operating. */
  reports: MonthlyReport[];
}

/** POST /api/checkout/create */
export interface CreateCheckoutRequest {
  projectId: string;
  cells: number;
  /** Defaults to "you". The investor agent sends "agent". */
  placedBy?: "you" | "agent";
}
export interface CreateCheckoutResponse {
  orderId: string;
  mode: Mode;
  /**
   * Where to send the browser so the buyer can approve the payment.
   * Sandbox mode: the PayPal approval page.
   * Demo mode: /checkout/approve?token=<orderId> (a stand-in page inside this app).
   * After approval the browser lands on /checkout/return?token=<orderId>.
   */
  approveUrl: string;
  amountCents: number;
}

/** POST /api/checkout/capture */
export interface CaptureCheckoutRequest {
  orderId: string;
}
export interface CaptureCheckoutResponse {
  purchase: Purchase;
  project: ProjectView;
}

/** GET /api/checkout/order?token=<orderId>  (used by the demo approval page) */
export interface OrderSummaryResponse {
  purchase: Purchase;
  project: ProjectView;
  mode: Mode;
}

export interface HoldingView {
  project: ProjectView;
  cells: number;
  costCents: number;
  /** Share of the plant owned, 0-100. */
  sharePct: number;
  earnedCents: number;
  /** Estimated income for a typical month. Zero until vetted. Not guaranteed. */
  estMonthlyCents: number;
}

/** GET /api/portfolio */
export interface PortfolioResponse {
  investor: Investor;
  holdings: HoldingView[];
  purchases: (Purchase & { projectName: string })[];
  payouts: (Payout & { projectName: string })[];
  totals: {
    investedCents: number;
    earnedCents: number;
    cells: number;
    /** Clean energy attributable to the investor's cells so far. */
    kwhGenerated: number;
  };
}

/** One line in the agent activity log shown on the operations page. */
export interface AgentStep {
  agent: "vetting" | "monitoring" | "payout" | "investor";
  /** Short label, e.g. "Checked meter readings". */
  title: string;
  /** One or two sentences of detail. */
  detail: string;
  status: "ok" | "warning" | "error";
}

/** GET /api/ops */
export interface OpsResponse {
  projects: ProjectView[];
  /** Most recent first. */
  reports: (MonthlyReport & { projectName: string })[];
  /** Most recent first. */
  payouts: (Payout & { projectName: string; investorName: string })[];
  totals: {
    paidOutCents: number;
    kwhGenerated: number;
    payoutsSent: number;
  };
}

/** POST /api/ops/fast-forward  (demo control: sells remaining cells to sample investors and marks the plant installed) */
export interface FastForwardRequest {
  projectId: string;
}
export interface FastForwardResponse {
  project: ProjectView;
  steps: AgentStep[];
}

/** POST /api/ops/run-month  (simulates one month of output, verifies it, pays owners) */
export interface RunMonthRequest {
  projectId: string;
  /** Optional demo control to show the monitoring agent catching a problem. */
  scenario?: "normal" | "underperform";
}
export interface RunMonthResponse {
  report: MonthlyReport;
  payouts: (Payout & { investorName: string })[];
  steps: AgentStep[];
  mode: Mode;
}

/** POST /api/vetting  (re-runs the vetting agent for a project) */
export interface VettingRequest {
  projectId: string;
}
export interface VettingResponse {
  project: ProjectView;
  steps: AgentStep[];
}

/** A purchase the investor agent wants to make. Nothing is charged until approved. */
export interface AgentProposal {
  id: string;
  /** Plain-language reason for the allocation. */
  rationale: string;
  items: {
    projectId: string;
    projectName: string;
    cells: number;
    amountCents: number;
    reason: string;
  }[];
  totalCents: number;
  /** False when the proposal breaks the mandate; then `blockedReason` says why. */
  withinMandate: boolean;
  blockedReason?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** POST /api/agent/chat */
export interface AgentChatRequest {
  messages: ChatMessage[];
}
export interface AgentChatResponse {
  reply: string;
  proposal?: AgentProposal;
  aiMode: AiMode;
}

/** POST /api/agent/execute  (carries out an approved proposal) */
export interface AgentExecuteRequest {
  proposal: AgentProposal;
}
export interface AgentExecuteResponse {
  purchases: (Purchase & { projectName: string })[];
  steps: AgentStep[];
  mode: Mode;
}

/** GET and PUT /api/agent/mandate */
export interface MandateResponse {
  mandate: Mandate;
  /** Spent by the agent so far this calendar month. */
  spentThisMonthCents: number;
}

/** POST /api/demo/reset */
export interface ResetResponse {
  ok: true;
}

/** Every route returns this shape with a 4xx/5xx status on failure. */
export interface ApiError {
  error: string;
}
