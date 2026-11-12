// Investor agent: turns a plain instruction into a purchase proposal that fits
// the investor's mandate, and carries out approved proposals.
// Code decides cells and amounts; the model (live mode) only chooses and explains.

import type {
  AgentExecuteResponse,
  AgentProposal,
  AgentStep,
  ChatMessage,
  ProjectView,
} from "../api-types";
import { aiMode, callClaude, textOf, WRITING_STYLE, type AiMessage, type AiTool } from "../ai";
import {
  agentSpentThisMonth,
  ApiError,
  capturePurchase,
  checkCells,
  listViews,
  requireProject,
  serialize,
  startPurchase,
} from "../domain";
import { kindLabel, money, num } from "../format";
import { paypalMode } from "../paypal";
import { getMandate, newId } from "../store";
import type { Mandate, ProjectKind } from "../types";

interface Context {
  views: ProjectView[];
  mandate: Mandate;
  spentCents: number;
}

async function loadContext(): Promise<Context> {
  const [views, mandate, spentCents] = await Promise.all([listViews(), getMandate(), agentSpentThisMonth()]);
  return { views, mandate, spentCents };
}

function remainingBudget(ctx: Context): number {
  return Math.max(0, ctx.mandate.monthlyBudgetCents - ctx.spentCents);
}

function limitsText(ctx: Context): string {
  return `up to ${money(ctx.mandate.maxPerPurchaseCents)} per purchase, ${money(remainingBudget(ctx))} of ${money(ctx.mandate.monthlyBudgetCents)} left this month`;
}

function describe(p: ProjectView): string {
  const v = p.vetting!;
  return `Vetting score ${v.score}/100 (grade ${v.grade}), ${p.fundedPct}% funded, ${num(p.cellsAvailable)} cells left, estimated income about ${num(v.estimatedYieldPct, 1)}% a year (not guaranteed)`;
}

// ---------- Proposals ----------

interface PurchaseRequest {
  projectId: string;
  amountCents?: number;
  cells?: number;
  reason: string;
}

/**
 * Turns requests into a proposal that fits availability and the mandate,
 * scaling down where needed. `notes` explains every adjustment.
 */
function buildProposal(
  requests: PurchaseRequest[],
  rationale: string,
  ctx: Context,
): { proposal?: AgentProposal; notes: string[] } {
  const notes: string[] = [];
  const wanted: AgentProposal["items"] = [];
  const fitted: AgentProposal["items"] = [];
  let budgetLeft = remainingBudget(ctx);

  for (const r of requests) {
    const p = ctx.views.find((v) => v.id === r.projectId);
    if (!p) {
      notes.push(`I could not find a project called ${r.projectId}.`);
      continue;
    }
    if (p.status !== "funding" || p.cellsAvailable === 0) {
      notes.push(`${p.name} is fully funded, so it has no cells to buy.`);
      continue;
    }
    const asked = r.cells ?? Math.floor((r.amountCents ?? 0) / p.cellPriceCents);
    if (asked < 1) {
      notes.push(`One cell in ${p.name} costs ${money(p.cellPriceCents)}, more than the amount asked.`);
      continue;
    }
    let cells = Math.min(asked, p.cellsAvailable);
    wanted.push(item(p, cells, r.reason));
    if (cells < asked) notes.push(`Only ${num(p.cellsAvailable)} cells are left in ${p.name}.`);

    const perPurchaseCap = Math.floor(ctx.mandate.maxPerPurchaseCents / p.cellPriceCents);
    if (cells > perPurchaseCap) {
      cells = perPurchaseCap;
      notes.push(`Your limit is ${money(ctx.mandate.maxPerPurchaseCents)} per purchase, so ${p.name} is scaled down to ${money(cells * p.cellPriceCents)}.`);
    }
    const budgetCap = Math.floor(budgetLeft / p.cellPriceCents);
    if (cells > budgetCap) {
      cells = budgetCap;
      notes.push(
        cells > 0
          ? `Only ${money(budgetLeft)} of your monthly budget is left, so ${p.name} is scaled down to ${money(cells * p.cellPriceCents)}.`
          : `Your monthly budget of ${money(ctx.mandate.monthlyBudgetCents)} has no room left for ${p.name}.`,
      );
    }
    if (cells > 0) {
      fitted.push(item(p, cells, r.reason));
      budgetLeft -= cells * p.cellPriceCents;
    }
  }

  if (fitted.length > 0) {
    return { proposal: proposalOf(fitted, rationale, true), notes };
  }
  if (wanted.length > 0) {
    return { proposal: proposalOf(wanted, rationale, false, notes.join(" ")), notes };
  }
  return { notes };
}

function item(p: ProjectView, cells: number, reason: string): AgentProposal["items"][number] {
  return { projectId: p.id, projectName: p.name, cells, amountCents: cells * p.cellPriceCents, reason };
}

function proposalOf(
  items: AgentProposal["items"],
  rationale: string,
  withinMandate: boolean,
  blockedReason?: string,
): AgentProposal {
  return {
    id: newId("proposal"),
    rationale,
    items,
    totalCents: items.reduce((sum, i) => sum + i.amountCents, 0),
    withinMandate,
    ...(blockedReason ? { blockedReason } : {}),
  };
}

function proposalText(proposal: AgentProposal | undefined, notes: string[], ctx: Context): string {
  const lines: string[] = [];
  if (proposal?.withinMandate) {
    const list = proposal.items.map((i) => `${num(i.cells)} cells in ${i.projectName} for ${money(i.amountCents)}`).join(" and ");
    lines.push(`I propose buying ${list}. ${proposal.rationale}`);
    if (notes.length) lines.push(notes.join(" "));
    lines.push(`This fits your limits (${limitsText(ctx)}). Nothing is charged until you approve.`);
  } else if (proposal) {
    lines.push(`I can't buy this within your limits. ${proposal.blockedReason} You can raise your limits or ask for a smaller amount.`);
  } else {
    lines.push(notes.join(" ") || "I couldn't find anything to buy for that request.");
  }
  return lines.join("\n\n");
}

// ---------- Demo mode: rule-based reading of the instruction ----------

const KIND_WORDS: Record<ProjectKind, RegExp> = {
  clinic: /clinic|health|hospital|medical|vaccine|maternity/,
  irrigation: /irrigat|farm|pump|crop|water|agricultur/,
  "cold-storage": /cold|storage|fridge|produce|fish|spoil/,
};

function parseAmountCents(text: string): number | undefined {
  const m = text.match(/\$\s*(\d[\d,]*(?:\.\d{1,2})?)/) ?? text.match(/(\d[\d,]*(?:\.\d{1,2})?)\s*(?:dollars|usd|bucks)/);
  return m ? Math.round(parseFloat(m[1].replace(/,/g, "")) * 100) : undefined;
}

function demoReply(messages: ChatMessage[], ctx: Context): { reply: string; proposal?: AgentProposal } {
  const text = ([...messages].reverse().find((m) => m.role === "user")?.content ?? "").toLowerCase();
  const amountCents = parseAmountCents(text);
  const cells = Number(text.match(/(\d+)\s*cells?\b/)?.[1]) || undefined;

  const kinds = (Object.keys(KIND_WORDS) as ProjectKind[]).filter((k) => KIND_WORDS[k].test(text));
  const countries = [...new Set(ctx.views.map((v) => v.country))].filter((c) => text.includes(c.toLowerCase()));
  const matching = ctx.views.filter(
    (v) => (!kinds.length || kinds.includes(v.kind)) && (!countries.length || countries.includes(v.country)),
  );
  const open = matching.filter((v) => v.status === "funding" && v.cellsAvailable > 0);

  if (/limit|budget|mandate/.test(text) && !amountCents && !cells) {
    return { reply: `Your limits are ${limitsText(ctx)}. You can change them in the mandate settings.` };
  }
  if (!open.length) {
    const closed = matching.map((v) => v.name).join(" and ");
    return {
      reply: closed
        ? `${closed} ${matching.length === 1 ? "is" : "are"} already fully funded, so there are no cells left to buy. Ask me what is still raising money.`
        : "No project matches that request. Try asking what you should invest in.",
    };
  }

  const closest = /closest|nearly|almost|fully funded|finish/.test(text);
  const spread = /spread|split|diversif|each|all of/.test(text);
  const ranked = [...open].sort((a, b) =>
    closest ? a.cellsAvailable - b.cellsAvailable : b.vetting!.score - a.vetting!.score,
  );

  // A question with no amount: give advice and suggest a modest first purchase.
  if (!amountCents && !cells) {
    const top = ranked[0];
    const starter = Math.min(5000, ctx.mandate.maxPerPurchaseCents); // scaled to the budget below
    const overview = ranked.map((v) => `- ${v.name}, ${v.country} (${kindLabel[v.kind].toLowerCase()}). ${describe(v)}.`).join("\n");
    const { proposal, notes } = buildProposal(
      [{ projectId: top.id, amountCents: starter, reason: `Highest vetting score among open projects. ${describe(top)}.` }],
      `${top.name} has the strongest vetting score of the projects still raising money.`,
      ctx,
    );
    return {
      reply: `These projects are raising money now:\n${overview}\n\n${proposalText(proposal, notes, ctx)}`,
      proposal,
    };
  }

  const targets = spread && ranked.length > 1 ? ranked : ranked.slice(0, 1);
  const share = amountCents ? Math.floor(amountCents / targets.length) : undefined;
  const requests = targets.map((v) => ({
    projectId: v.id,
    amountCents: share,
    cells,
    reason: closest
      ? `Closest to fully funded. ${describe(v)}.`
      : `${describe(v)}.`,
  }));
  const rationale = closest
    ? `${targets[0].name} is the project closest to being fully funded, so your money helps it reach installation sooner.`
    : targets.length > 1
      ? `The amount is split evenly across ${targets.length} open projects to spread the risk.`
      : `${targets[0].name} matches your request and has a vetting score of ${targets[0].vetting!.score}/100.`;
  const { proposal, notes } = buildProposal(requests, rationale, ctx);
  return { reply: proposalText(proposal, notes, ctx), proposal };
}

// ---------- Live mode: Claude with tools ----------

const TOOLS: AiTool[] = [
  {
    name: "list_projects",
    description: "List every SunShare project with its vetting figures, funding progress and cells left.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "propose_purchase",
    description:
      "Propose buying cells for the investor. The server works out cells and prices and scales the proposal to fit availability and the investor's limits; read the result before replying. Calling again replaces the previous proposal.",
    input_schema: {
      type: "object",
      properties: {
        rationale: { type: "string", description: "One or two plain sentences on why this allocation." },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              projectId: { type: "string" },
              amountUsd: { type: "number", description: "Dollars to spend on this project, as the investor said it." },
              cells: { type: "integer", description: "Use instead of amountUsd when the investor asked for a number of cells." },
              reason: { type: "string", description: "One plain sentence on why this project." },
            },
            required: ["projectId", "reason"],
          },
        },
      },
      required: ["rationale", "items"],
    },
  },
];

function projectFacts(ctx: Context) {
  return ctx.views.map((v) => ({
    id: v.id,
    name: v.name,
    kind: v.kind,
    country: v.country,
    status: v.status,
    impact: v.impact,
    cellPrice: money(v.cellPriceCents),
    cellsAvailable: v.cellsAvailable,
    fundedPct: v.fundedPct,
    vettingScore: v.vetting?.score,
    grade: v.vetting?.grade,
    estimatedYearlyIncomePct: v.vetting?.estimatedYieldPct,
    risks: v.vetting?.risks,
  }));
}

async function liveReply(messages: ChatMessage[], ctx: Context): Promise<{ reply: string; proposal?: AgentProposal }> {
  const system =
    `You are the SunShare investor agent. You help one investor buy solar cells in plants that power African clinics and farms. ${WRITING_STYLE}\n` +
    `The investor's mandate: ${limitsText(ctx)}. Only projects with status "funding" and cells left can be bought.\n` +
    "Use list_projects to see the options. When the investor wants to invest, or asks what to invest in, call propose_purchase; the server scales it to the limits and tells you what changed. " +
    "Never claim a purchase has been made: the investor approves proposals with a button. Keep replies to a few short sentences.";

  const convo: AiMessage[] = messages
    .filter((m) => m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));
  while (convo.length && convo[0].role !== "user") convo.shift();
  if (!convo.length) throw new ApiError(400, "Send at least one message from the investor.");

  let proposal: AgentProposal | undefined;
  for (let turn = 0; turn < 6; turn++) {
    const res = await callClaude({ system, messages: convo, tools: TOOLS });
    const calls = res.content.filter((b) => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !calls.length) {
      return { reply: textOf(res) || proposalText(proposal, [], ctx), proposal };
    }
    convo.push({ role: "assistant", content: res.content });
    convo.push({
      role: "user",
      content: calls.map((call) => {
        const result = runTool(call.name, call.input, ctx);
        if (result.proposal !== undefined) proposal = result.proposal ?? undefined;
        return { type: "tool_result" as const, tool_use_id: call.id, content: JSON.stringify(result.output) };
      }),
    });
  }
  return { reply: proposalText(proposal, [], ctx), proposal };
}

function runTool(
  name: string,
  input: unknown,
  ctx: Context,
): { output: unknown; proposal?: AgentProposal | null } {
  if (name === "list_projects") return { output: projectFacts(ctx) };
  if (name !== "propose_purchase") return { output: { error: `Unknown tool ${name}` } };

  const args = input as {
    rationale?: string;
    items?: { projectId: string; amountUsd?: number; cells?: number; reason?: string }[];
  };
  const requests = (args.items ?? []).map((i) => ({
    projectId: String(i.projectId),
    amountCents: typeof i.amountUsd === "number" ? Math.round(i.amountUsd * 100) : undefined,
    cells: Number.isInteger(i.cells) ? i.cells : undefined,
    reason: i.reason ?? "",
  }));
  const { proposal, notes } = buildProposal(requests, args.rationale ?? "", ctx);
  return {
    output: proposal
      ? { proposal: { items: proposal.items, total: money(proposal.totalCents), withinMandate: proposal.withinMandate, blockedReason: proposal.blockedReason }, adjustments: notes }
      : { error: "Nothing could be proposed.", adjustments: notes },
    proposal: proposal ?? null,
  };
}

export async function chat(messages: ChatMessage[]): Promise<{ reply: string; proposal?: AgentProposal }> {
  const ctx = await loadContext();
  return aiMode() === "live" ? liveReply(messages, ctx) : demoReply(messages, ctx);
}

// ---------- Execute ----------

/** Re-checks an approved proposal against current prices, availability and the mandate. */
async function recheck(proposal: AgentProposal, ctx: Context) {
  if (!Array.isArray(proposal.items) || proposal.items.length === 0) {
    throw new ApiError(400, "The proposal has no purchases.");
  }
  let total = 0;
  const checked = [];
  for (const i of proposal.items) {
    const p = await requireProject(i.projectId);
    checkCells(p, i.cells);
    const amountCents = i.cells * p.cellPriceCents;
    if (amountCents !== i.amountCents) {
      throw new ApiError(409, `The price for ${p.name} has changed. Ask the agent for a new proposal.`);
    }
    if (amountCents > ctx.mandate.maxPerPurchaseCents) {
      throw new ApiError(409, `${money(amountCents)} in ${p.name} is above your ${money(ctx.mandate.maxPerPurchaseCents)} per-purchase limit.`);
    }
    total += amountCents;
    checked.push({ project: p, cells: i.cells, amountCents });
  }
  if (total > remainingBudget(ctx)) {
    throw new ApiError(409, `This proposal costs ${money(total)} but only ${money(remainingBudget(ctx))} of your monthly budget is left.`);
  }
  return { checked, total };
}

/**
 * Carries out an approved proposal.
 *
 * Demo mode: each purchase is paid and recorded straight away.
 * Sandbox mode: a server cannot approve a PayPal order on the buyer's behalf
 * without a vaulted payment method, which this prototype does not set up. So the
 * agent creates real PayPal orders and returns their approval links; ownership is
 * recorded only when the investor approves in PayPal and /checkout/return captures.
 */
export function execute(proposal: AgentProposal, origin: string): Promise<AgentExecuteResponse> {
  // One execution at a time in this process, so two approvals cannot both use the
  // same budget. Across Worker isolates the budget is enforced again, atomically,
  // when each purchase is captured (store.holdCells).
  return serialize("agent-execute", () => executeNow(proposal, origin));
}

async function executeNow(proposal: AgentProposal, origin: string): Promise<AgentExecuteResponse> {
  const ctx = await loadContext();
  const { checked, total } = await recheck(proposal, ctx);
  const mode = paypalMode();
  const steps: AgentStep[] = [
    {
      agent: "investor",
      title: "Re-checked the proposal on the server",
      detail: `Prices, cells left and your limits confirmed. ${money(total)} fits within ${money(ctx.mandate.maxPerPurchaseCents)} per purchase and the ${money(remainingBudget(ctx))} left this month.`,
      status: "ok",
    },
  ];
  const purchases: AgentExecuteResponse["purchases"] = [];

  for (const { project, cells, amountCents } of checked) {
    const fresh = await requireProject(project.id);
    const { purchase, approveUrl } = await startPurchase(fresh, cells, "agent", origin);
    if (mode === "sandbox") {
      purchases.push({ ...purchase, projectName: project.name });
      steps.push({
        agent: "investor",
        title: `Waiting for your PayPal approval: ${project.name}`,
        detail: `PayPal order ${purchase.paypalOrderId} for ${num(cells)} cells (${money(amountCents)}) is ready. Approve it here to complete the purchase: ${approveUrl}`,
        status: "warning",
      });
      continue;
    }
    const done = await capturePurchase(purchase.paypalOrderId);
    purchases.push({ ...done, projectName: project.name });
    steps.push({
      agent: "investor",
      title: `Bought ${num(cells)} cells in ${project.name} for ${money(amountCents)}`,
      detail: `Paid with PayPal order ${done.paypalOrderId}. Demo mode, so no real money moved.`,
      status: "ok",
    });
  }
  return { purchases, steps, mode };
}
