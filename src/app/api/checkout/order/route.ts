import type { NextRequest } from "next/server";
import type { OrderSummaryResponse } from "@/lib/api-types";
import { ApiError, getView, handle, ready } from "@/lib/domain";
import { paypalMode } from "@/lib/paypal";
import { getPurchaseByOrderId } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async (): Promise<OrderSummaryResponse> => {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) throw new ApiError(400, "Missing order token.");
    await ready();
    const purchase = await getPurchaseByOrderId(token);
    if (!purchase) throw new ApiError(404, "Order not found.");
    return { purchase, project: await getView(purchase.projectId), mode: paypalMode() };
  });
}
