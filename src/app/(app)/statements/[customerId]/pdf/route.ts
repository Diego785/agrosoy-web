import type { NextRequest } from "next/server";
import { statementPdfResponse } from "@/modules/receivables/presentation/statement-pdf";

export async function GET(request: NextRequest, { params }: RouteContext<"/statements/[customerId]/pdf">) {
  return statementPdfResponse((await params).customerId, request.nextUrl.searchParams.get("campaign"));
}
