import { NextResponse } from "next/server";
import { checkUrlWithVariants, ValidateResult } from "@/lib/urlCheck";

export type { ValidateResult };

export async function POST(request: Request): Promise<NextResponse<ValidateResult>> {
  let url: string;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ valid: false, finalUrl: null, status: 0, reason: "bad_request" });
  }

  const result = await checkUrlWithVariants(url);
  return NextResponse.json(result);
}
