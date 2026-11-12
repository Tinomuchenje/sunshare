import type { ResetResponse } from "@/lib/api-types";
import { handle } from "@/lib/domain";
import { resetStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  return handle(async (): Promise<ResetResponse> => {
    await resetStore();
    return { ok: true };
  });
}
