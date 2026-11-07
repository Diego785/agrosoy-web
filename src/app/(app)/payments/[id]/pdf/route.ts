import { receiptPdfResponse } from "@/modules/collections/presentation/receipt-pdf";

export async function GET(_request: Request, { params }: RouteContext<"/payments/[id]/pdf">) {
  return receiptPdfResponse((await params).id);
}
