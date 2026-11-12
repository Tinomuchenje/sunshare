import type { CreateCheckoutRequest, CreateCheckoutResponse } from "@/lib/api-types";
import { ApiError, assertWithinMandate, handle, readJson, ready, requireProject, siteOrigin, startPurchase } from "@/lib/domain";
import { paypalMode } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async (): Promise<CreateCheckoutResponse> => {
    const body = await readJson<CreateCheckoutRequest>(req);
    const placedBy = body.placedBy ?? "you";
    if (placedBy !== "you" && placedBy !== "agent") {
      throw new ApiError(400, 'placedBy must be "you" or "agent".');
    }
    await ready();
    const project = await requireProject(body.projectId);
    if (placedBy === "agent" && typeof body.cells === "number") {
      await assertWithinMandate(body.cells * project.cellPriceCents);
    }
    const { purchase, approveUrl } = await startPurchase(
      project,
      body.cells as number,
      placedBy,
      siteOrigin(req),
    );
    return {
      orderId: purchase.paypalOrderId,
      mode: paypalMode(),
      approveUrl,
      amountCents: purchase.amountCents,
    };
  });
}
