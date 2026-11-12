import type { HoldingView, PortfolioResponse } from "@/lib/api-types";
import { handle, listViews, ready } from "@/lib/domain";
import { YOU_ID } from "@/lib/seed";
import * as store from "@/lib/store";
import { MAINTENANCE_RESERVE_RATE, PLATFORM_FEE_RATE, type Payout } from "@/lib/types";

export const dynamic = "force-dynamic";

const newestFirst = (a: { createdAt: string }, b: { createdAt: string }) =>
  b.createdAt.localeCompare(a.createdAt);
const isPaid = (p: Payout) => p.status !== "failed";

export async function GET() {
  return handle(async (): Promise<PortfolioResponse> => {
    await ready();
    const [investor, views, holdings, purchases, payouts, reports] = await Promise.all([
      store.getInvestor(YOU_ID),
      listViews(),
      store.listHoldings({ investorId: YOU_ID }),
      store.listPurchases(YOU_ID),
      store.listPayouts({ investorId: YOU_ID }),
      store.listReports(),
    ]);
    const view = new Map(views.map((v) => [v.id, v]));
    const shareRate = 1 - PLATFORM_FEE_RATE - MAINTENANCE_RESERVE_RATE;

    const holdingViews: HoldingView[] = holdings
      .filter((h) => h.cells > 0)
      .map((h) => {
        const p = view.get(h.projectId)!;
        const typicalMonthCents = p.vetting
          ? p.vetting.forecastKwhPerMonth * p.utilisation * p.tariffCentsPerKwh * shareRate
          : 0;
        return {
          project: p,
          cells: h.cells,
          costCents: h.cells * p.cellPriceCents,
          sharePct: (h.cells * 100) / p.totalCells,
          earnedCents: payouts
            .filter((x) => x.projectId === p.id && isPaid(x))
            .reduce((sum, x) => sum + x.amountCents, 0),
          estMonthlyCents: Math.floor((typicalMonthCents * h.cells) / p.totalCells),
        };
      });

    // Energy from the investor's cells: each paid month's output × their share that month.
    const actualKwh = new Map(reports.map((r) => [r.id, r.actualKwh]));
    const kwhGenerated = payouts.reduce(
      (sum, x) => sum + ((actualKwh.get(x.reportId) ?? 0) * x.cells) / view.get(x.projectId)!.totalCells,
      0,
    );
    const name = (projectId: string) => view.get(projectId)?.name ?? projectId;

    return {
      investor: investor!,
      holdings: holdingViews,
      purchases: purchases.sort(newestFirst).map((x) => ({ ...x, projectName: name(x.projectId) })),
      payouts: payouts.sort(newestFirst).map((x) => ({ ...x, projectName: name(x.projectId) })),
      totals: {
        investedCents: holdingViews.reduce((sum, h) => sum + h.costCents, 0),
        earnedCents: payouts.filter(isPaid).reduce((sum, x) => sum + x.amountCents, 0),
        cells: holdingViews.reduce((sum, h) => sum + h.cells, 0),
        kwhGenerated: Math.round(kwhGenerated),
      },
    };
  });
}
