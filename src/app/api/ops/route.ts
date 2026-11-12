import type { OpsResponse } from "@/lib/api-types";
import { handle, listViews, ready } from "@/lib/domain";
import * as store from "@/lib/store";

export const dynamic = "force-dynamic";

const newestFirst = (a: { createdAt: string; month: string }, b: { createdAt: string; month: string }) =>
  b.createdAt.localeCompare(a.createdAt) || b.month.localeCompare(a.month);

export async function GET() {
  return handle(async (): Promise<OpsResponse> => {
    await ready();
    const [projects, reports, payouts, investors] = await Promise.all([
      listViews(),
      store.listReports(),
      store.listPayouts(),
      store.listInvestors(),
    ]);
    const projectName = new Map(projects.map((p) => [p.id, p.name]));
    const investorName = new Map(investors.map((i) => [i.id, i.name]));
    const paid = payouts.filter((x) => x.status !== "failed");

    return {
      projects,
      reports: reports
        .sort(newestFirst)
        .map((r) => ({ ...r, projectName: projectName.get(r.projectId) ?? r.projectId })),
      payouts: payouts.sort(newestFirst).map((x) => ({
        ...x,
        projectName: projectName.get(x.projectId) ?? x.projectId,
        investorName: investorName.get(x.investorId) ?? x.investorId,
      })),
      totals: {
        paidOutCents: paid.reduce((sum, x) => sum + x.amountCents, 0),
        kwhGenerated: reports.reduce((sum, r) => sum + r.actualKwh, 0),
        payoutsSent: paid.length,
      },
    };
  });
}
