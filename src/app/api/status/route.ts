import type { StatusResponse } from "@/lib/api-types";
import { aiMode } from "@/lib/ai";
import { handle } from "@/lib/domain";
import { paypalMode } from "@/lib/paypal";

// Modes come from environment variables, which must be read at request time.
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async (): Promise<StatusResponse> => ({
    paypalMode: paypalMode(),
    aiMode: aiMode(),
  }));
}
