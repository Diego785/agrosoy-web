import "server-only";
import { Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { contentLabel } from "@/modules/catalog/presentation/catalog-labels";
import { measureDelivered, measureOf } from "@/modules/catalog/domain/product";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import { getDb } from "@/shared/infrastructure/db/client";
import { COMPANY } from "@/shared/presentation/company-profile";
import { formatDocumentNumber, formatMoney, formatQuantity, formatRate } from "@/shared/presentation/format";
import { notFoundAsNull } from "@/shared/presentation/not-found";
import { PDF_COLORS, PdfBlank, PdfCheck, PdfFormPage, PdfLogo, pdfResponse } from "@/shared/presentation/pdf";
import type { NoteLineView, NoteView } from "../application/note-ports";
import { getNote } from "../application/note-use-cases";
import { noteDeps } from "./note-deps";

const FREE_LABELS = { bonus: "bonificación", sample: "muestra" } as const;
const PDF_TITLES = {
  delivery: "Boleta de entrega",
  return: "Devolución",
  campaign_transfer: "Traspaso",
} as const;
/** The form always shows at least this many ruled rows, like the paper pad. */
const MIN_ROWS = 10;

const { green: GREEN, orange: ORANGE, red: RED, tan: TAN, rule: RULE, muted: MUTED } = PDF_COLORS;

const COLUMNS = [
  { header: "Cantidad", width: "10%", align: "center" },
  { header: "Descripción", width: "38%", align: "left" },
  { header: "Presentación", width: "14%", align: "center" },
  { header: "Total Lts/Kg", width: "12%", align: "right" },
  { header: "P.U. $us", width: "12%", align: "right" },
  { header: "Total $us", width: "14%", align: "right" },
] as const;

/** Total liters or kilos of a line; pieces have no such total. */
function lineMeasure(line: NoteLineView): string {
  if (measureOf(line.unit) === "u") return "";
  const measure = measureDelivered(
    { content: Quantity.parse(line.content), unit: line.unit, saleUnit: line.saleUnit },
    Quantity.parse(line.quantity),
  );
  return formatQuantity(measure.toDecimalString());
}

function noteNumber(note: NoteView): string {
  if (note.imported) return `Nº ${note.imported.sheetNumber ?? "—"} (de planilla)`;
  return note.number ? `Nº ${formatDocumentNumber(note.number)}` : "SIN NÚMERO";
}

/** A person's box at the foot of the form: signature line, then name, position and CI. */
function PersonBox({
  title,
  name,
  position,
  documentId,
  children,
}: {
  title: string;
  name?: string | null;
  position?: string | null;
  documentId?: string | null;
  children?: ReactNode;
}) {
  return (
    <View style={{ flex: 1, padding: 6, gap: 5 }}>
      <Text style={{ fontFamily: "Helvetica-Bold", color: GREEN }}>{title}</Text>
      {children ?? (
        <>
          <PdfBlank label="Firma:" />
          <PdfBlank label="Nombres:" value={name} />
          <PdfBlank label="Cargo:" value={position} />
          <PdfBlank label="C.I.:" value={documentId} />
        </>
      )}
    </View>
  );
}

/** The note as Agrosoil prints it: one form for delivery, return and transfer (D26). */
export function NotePdf({ note }: { note: NoteView }) {
  const total = Money.sum(note.lines.map((line) => Money.parse(line.total)));
  const bob = ExchangeRate.parse(note.exchangeRate).toBob(total);
  const [year, month, day] = note.noteDate.split("-");
  const isReturn = note.type === "return";
  const isDelivery = note.type === "delivery";

  const agrosoilPerson = {
    name: note.handedOverBy?.name ?? note.technician?.name,
    position: note.handedOverBy?.position,
    documentId: note.handedOverBy?.documentId,
  };
  const customerPerson = {
    name: note.receiver.name,
    position: note.receiver.relationship,
    documentId: note.receiver.documentId,
  };
  const emptyRows = Math.max(0, MIN_ROWS - note.lines.length);
  const observations = [
    note.original &&
      `Sobre la boleta N.º ${note.original.number ? formatDocumentNumber(note.original.number) : "—"}.`,
    note.observations,
    note.voided && `Anulada: ${note.voided.reason}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <PdfFormPage
      title={`${PDF_TITLES[note.type]} ${noteNumber(note)}`}
      watermark={note.status === "voided" ? "ANULADA" : note.status === "draft" ? "BORRADOR" : null}
    >
      <View style={{ borderWidth: 1.2, borderColor: GREEN, borderRadius: 8 }}>
        {/* Letterhead */}
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: GREEN }}>
          <View
            style={{
              width: 92,
              alignItems: "center",
              justifyContent: "center",
              borderRightWidth: 1,
              borderColor: GREEN,
              padding: 6,
            }}
          >
            <PdfLogo width={76} />
          </View>
          <View style={{ flex: 1, padding: 6, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Text style={{ color: ORANGE, fontFamily: "Helvetica-Bold", fontSize: 10 }}>NOTA:</Text>
              <PdfCheck label="ENTREGA" checked={isDelivery} color={GREEN} />
              <PdfCheck label="DEVOLUCIÓN" checked={isReturn} color={GREEN} />
              <PdfCheck label="TRASPASO" checked={note.type === "campaign_transfer"} color={GREEN} />
            </View>
            <Text
              style={{
                textAlign: "center",
                color: RED,
                fontFamily: "Courier-Bold",
                fontSize: 14,
              }}
            >
              {noteNumber(note)}
            </Text>
            <View style={{ flexDirection: "row", gap: 10, fontSize: 7, color: MUTED }}>
              <View style={{ flex: 1 }}>
                <Text>Telf. Of.: {COMPANY.phone}</Text>
                <Text>Cel.: {COMPANY.mobile}</Text>
                <Text>{COMPANY.email}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text>Facebook: {COMPANY.facebook}</Text>
                <Text>{COMPANY.website}</Text>
                <Text>
                  {COMPANY.city} - {COMPANY.country}
                </Text>
              </View>
            </View>
          </View>
          <View style={{ width: 96, borderLeftWidth: 1, borderColor: GREEN }}>
            <Text
              style={{ textAlign: "center", paddingVertical: 4, color: GREEN, fontFamily: "Helvetica-Bold" }}
            >
              FECHA
            </Text>
            <View style={{ flexDirection: "row", backgroundColor: ORANGE }}>
              {["DÍA", "MES", "AÑO"].map((label) => (
                <Text
                  key={label}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    paddingVertical: 3,
                    color: "#ffffff",
                    fontFamily: "Helvetica-Bold",
                    fontSize: 7.5,
                  }}
                >
                  {label}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexGrow: 1, alignItems: "center" }}>
              {[day, month, year].map((part, index) => (
                <Text key={index} style={{ flex: 1, textAlign: "center", fontFamily: "Helvetica-Bold" }}>
                  {part}
                </Text>
              ))}
            </View>
          </View>
        </View>

        {/* Customer */}
        <View style={{ padding: 7, gap: 6, borderBottomWidth: 1, borderColor: GREEN }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <PdfBlank label="Cliente:" value={note.customer.name} flex={2.4} />
            <PdfBlank label="NIT o C.I.:" value={note.customer.taxId} flex={1.2} />
            <PdfBlank label="Hac.:" value={note.property?.name} flex={1.2} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <PdfCheck label="Contado" checked={isDelivery && note.paymentTerms === "cash"} color={GREEN} />
            <PdfCheck label="Crédito" checked={isDelivery && note.paymentTerms === "credit"} color={GREEN} />
            <Text
              style={{ marginLeft: "auto", color: ORANGE, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 }}
            >
              CAMPAÑA
            </Text>
            <CampaignBox
              label="Invierno"
              year={note.campaign.season === "winter" ? note.campaign.year : null}
            />
            <CampaignBox
              label="Verano"
              year={note.campaign.season === "summer" ? note.campaign.year : null}
            />
          </View>
        </View>

        {/* Lines */}
        <View
          style={{ flexDirection: "row", backgroundColor: TAN, borderBottomWidth: 0.8, borderColor: GREEN }}
        >
          {COLUMNS.map((column, index) => (
            <Text
              key={column.header}
              style={{
                width: column.width,
                paddingVertical: 4,
                paddingHorizontal: 3,
                textAlign: "center",
                fontFamily: "Helvetica-Bold",
                fontSize: 8,
                color: GREEN,
                borderLeftWidth: index === 0 ? 0 : 0.8,
                borderColor: GREEN,
              }}
            >
              {column.header}
            </Text>
          ))}
        </View>
        {note.lines.map((line) => (
          <LineRow
            key={line.id}
            cells={[
              formatQuantity(line.quantity),
              `${line.productName}${line.freeOfCharge ? ` (${FREE_LABELS[line.freeOfCharge]})` : ""}`,
              contentLabel(line),
              lineMeasure(line),
              line.freeOfCharge ? "—" : formatMoney(line.unitPrice),
              formatMoney(line.total),
            ]}
          />
        ))}
        {Array.from({ length: emptyRows }, (_, index) => (
          <LineRow key={index} cells={["", "", "", "", "", ""]} />
        ))}

        {/* Total */}
        <View style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: GREEN }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, padding: 6 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", color: GREEN }}>TOTAL</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5 }}>
              US$ {formatMoney(total.toDecimalString())}
            </Text>
            <Text style={{ color: MUTED }}>= Bs {formatMoney(bob.toDecimalString())}</Text>
          </View>
          <View
            style={{
              width: 92,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              padding: 6,
              borderLeftWidth: 1,
              borderColor: GREEN,
            }}
          >
            <Text style={{ fontFamily: "Helvetica-Bold", color: GREEN }}>T/C</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{formatRate(note.exchangeRate)}</Text>
          </View>
        </View>

        {/* Observations */}
        <View style={{ padding: 7, minHeight: 30, borderBottomWidth: 1, borderColor: GREEN }}>
          <PdfBlank label="Observaciones:" value={observations} />
        </View>

        {/* People */}
        <View style={{ flexDirection: "row" }}>
          <PersonBox title="Datos del Transportista:">
            <PdfBlank label="Empresa:" value={note.carrier.name} />
            <PdfBlank label="Vehículo:" value={note.carrier.vehicle} />
            <PdfBlank label="C.I.:" value={note.carrier.documentId} />
            <PdfBlank label="Firma:" />
          </PersonBox>
          <View style={{ width: 1, backgroundColor: GREEN }} />
          {/* On a return the customer's person hands over and Agrosoil's receives (D26). */}
          <PersonBox title="Persona que Entrega:" {...(isReturn ? customerPerson : agrosoilPerson)} />
          <View style={{ width: 1, backgroundColor: GREEN }} />
          <PersonBox title="Persona que Recibe:" {...(isReturn ? agrosoilPerson : customerPerson)} />
        </View>
      </View>
    </PdfFormPage>
  );
}

function CampaignBox({ label, year }: { label: string; year: number | null }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Text>{label}</Text>
      <View
        style={{
          width: 54,
          height: 16,
          borderWidth: 0.8,
          borderColor: GREEN,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: "Helvetica-Bold" }}>{year ?? " "}</Text>
      </View>
    </View>
  );
}

function LineRow({ cells }: { cells: string[] }) {
  return (
    <View style={{ flexDirection: "row", borderBottomWidth: 0.5, borderColor: RULE }} wrap={false}>
      {COLUMNS.map((column, index) => (
        <Text
          key={column.header}
          style={{
            width: column.width,
            minHeight: 16,
            paddingVertical: 3,
            paddingHorizontal: 3,
            textAlign: column.align,
            borderLeftWidth: index === 0 ? 0 : 0.8,
            borderColor: GREEN,
          }}
        >
          {cells[index] || " "}
        </Text>
      ))}
    </View>
  );
}

/** The note as a PDF for whoever may see notes; 404 when it doesn't exist. */
export async function notePdfResponse(noteId: string): Promise<Response> {
  const actor = await requireActor();
  const note = await getNote(noteDeps(getDb()), actor, noteId).catch(notFoundAsNull);
  if (!note) return new Response("No encontrado", { status: 404 });
  return pdfResponse(
    <NotePdf note={note} />,
    note.number ? `boleta-${formatDocumentNumber(note.number)}.pdf` : "boleta-borrador.pdf",
  );
}
