import type { Mandate } from "@/lib/types";
import type { MandateResponse } from "@/lib/api-types";
import { agentSpentThisMonth, ApiError, handle, readJson } from "@/lib/domain";
import { getMandate, setMandate } from "@/lib/store";

export const dynamic = "force-dynamic";

const MAX_CENTS = 10_000_000; // $100,000, a sanity cap for the prototype

async function current(): Promise<MandateResponse> {
  return { mandate: await getMandate(), spentThisMonthCents: await agentSpentThisMonth() };
}

export async function GET() {
  return handle(current);
}

export async function PUT(req: Request) {
  return handle(async (): Promise<MandateResponse> => {
    const body = await readJson<Mandate>(req);
    const valid = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_CENTS;
    if (!valid(body.maxPerPurchaseCents) || !valid(body.monthlyBudgetCents)) {
      throw new ApiError(400, "Limits must be whole numbers of cents between 0 and 10,000,000.");
    }
    await setMandate({
      maxPerPurchaseCents: body.maxPerPurchaseCents!,
      monthlyBudgetCents: body.monthlyBudgetCents!,
    });
    return current();
  });
}
