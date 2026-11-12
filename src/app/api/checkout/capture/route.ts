import type { CaptureCheckoutRequest, CaptureCheckoutResponse } from "@/lib/api-types";
import { ApiError, capturePurchase, getView, handle, readJson, ready } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async (): Promise<CaptureCheckoutResponse> => {
    const { orderId } = await readJson<CaptureCheckoutRequest>(req);
    if (typeof orderId !== "string" || !orderId) throw new ApiError(400, "Missing orderId.");
    await ready();
    const purchase = await capturePurchase(orderId);
    return { purchase, project: await getView(purchase.projectId) };
  });
}
