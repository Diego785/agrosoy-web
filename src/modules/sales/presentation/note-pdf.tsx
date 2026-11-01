import "server-only";
import { Text, View } from "@react-pdf/renderer";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { contentLabel, priceUnitLabel } from "@/modules/catalog/presentation/catalog-labels";
import { formatCustomerCode } from "@/modules/customers/domain/customer";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { formatDate, formatMoney, formatQuantity, formatRate } from "@/shared/presentation/format";
import { PdfFields, PdfPage, PdfTable, pdfResponse, pdfStyles } from "@/shared/presentation/pdf";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { getDb } from "@/shared/infrastructure/db/client";
import { notFoundAsNull } from "@/shared/presentation/not-found";
import type { NoteView } from "../application/note-ports";
import { getNote } from "../application/note-use-cases";
import { noteDeps } from "./note-deps";

const FREE_LABELS = { bonus: "bonificación", sample: "muestra" } as const;
const PDF_TITLES = {
  delivery: "BOLETA DE ENTREGA",
  return: "DEVOLUCIÓN",
  campaign_transfer: "TRASPASO DE CAMPAÑA",
} as const;

/** The delivery note as printed and signed: products, totals and who received them. */
export function NotePdf({ note }: { note: NoteView }) {
  const total = Money.sum(note.lines.map((line) => Money.parse(line.total)));
  const bob = ExchangeRate.parse(note.exchangeRate).toBob(total);
  const receiver = [
    note.receiver.name,
    note.receiver.documentId && `CI ${note.receiver.documentId}`,
    note.receiver.relationship,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PdfPage
      title={`${PDF_TITLES[note.type]}${note.number ? ` N.º ${note.number}` : ""}`}
      subtitle={`${formatDate(note.noteDate)} · Campaña ${campaignLabel(note.campaign)}`}
      stamp={note.status === "voided" ? "ANULADA" : note.status === "draft" ? "BORRADOR (SIN VALIDEZ)" : null}
    >
      {note.original && (
        <Text style={{ marginBottom: 8 }}>
          Sobre la boleta N.º {note.original.number} de la campaña {campaignLabel(note.original.campaign)}
        </Text>
      )}
      <PdfFields
        items={[
          ["Cliente", `${formatCustomerCode(note.customer.code)} · ${note.customer.name}`],
          ["Propiedad", note.property?.name],
          ["Técnico de venta", note.technician?.name],
          ["Pago", note.paymentTerms === "cash" ? "Contado" : "Crédito"],
          ["Tipo de cambio", `${formatRate(note.exchangeRate)} Bs por US$`],
          ["Factura SIN", note.taxInvoiceNumber],
        ]}
      />
      <PdfTable
        columns={[
          { header: "Producto", width: "46%" },
          { header: "Cantidad", width: "14%", align: "right" },
          { header: "Precio US$", width: "22%", align: "right" },
          { header: "Total US$", width: "18%", align: "right" },
        ]}
        rows={note.lines.map((line) => [
          `${line.productName} · ${contentLabel(line)}${line.freeOfCharge ? ` (${FREE_LABELS[line.freeOfCharge]})` : ""}`,
          formatQuantity(line.quantity),
          line.freeOfCharge ? "—" : `${formatMoney(line.unitPrice)} por ${priceUnitLabel(line)}`,
          formatMoney(line.total),
        ])}
        footer={[
          "Total",
          "",
          `Bs ${formatMoney(bob.toDecimalString())}`,
          `US$ ${formatMoney(total.toDecimalString())}`,
        ]}
      />
      {note.observations && (
        <View style={{ marginBottom: 8 }}>
          <Text style={pdfStyles.label}>Observaciones</Text>
          <Text>{note.observations}</Text>
        </View>
      )}
      {note.voided && (
        <Text style={[pdfStyles.muted, { marginBottom: 8 }]}>
          Motivo de la anulación: {note.voided.reason}
        </Text>
      )}
      <View style={pdfStyles.signatures}>
        <View style={pdfStyles.signature}>
          <Text>{note.type === "return" ? "Recibí conforme" : "Entregué conforme"}</Text>
          <Text style={pdfStyles.muted}>{note.technician?.name ?? "Agrosoil"}</Text>
        </View>
        <View style={pdfStyles.signature}>
          <Text>{note.type === "return" ? "Devolví conforme" : "Recibí conforme"}</Text>
          <Text style={pdfStyles.muted}>{receiver}</Text>
        </View>
      </View>
    </PdfPage>
  );
}

/** The note as a PDF for whoever may see notes; 404 when it doesn't exist. */
export async function notePdfResponse(noteId: string): Promise<Response> {
  const actor = await requireActor();
  const note = await getNote(noteDeps(getDb()), actor, noteId).catch(notFoundAsNull);
  if (!note) return new Response("No encontrado", { status: 404 });
  return pdfResponse(
    <NotePdf note={note} />,
    note.number ? `boleta-${note.number}.pdf` : "boleta-borrador.pdf",
  );
}
