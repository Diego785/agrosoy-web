import { notePdfResponse } from "@/modules/sales/presentation/note-pdf";

export async function GET(_request: Request, { params }: RouteContext<"/notes/[id]/pdf">) {
  return notePdfResponse((await params).id);
}
