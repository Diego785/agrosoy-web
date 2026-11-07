import "server-only";
import { Text, View } from "@react-pdf/renderer";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { amountInWords } from "@/shared/domain/amount-in-words";
import { Money } from "@/shared/domain/money";
import { getDb } from "@/shared/infrastructure/db/client";
import { COMPANY } from "@/shared/presentation/company-profile";
import { formatDocumentNumber, formatLongDate, formatMoney, formatRate } from "@/shared/presentation/format";
import { notFoundAsNull } from "@/shared/presentation/not-found";
import { PDF_COLORS, PdfBlank, PdfFormPage, PdfLogo, pdfResponse } from "@/shared/presentation/pdf";
import type { PaymentView } from "../application/collection-ports";
import { getPayment } from "../application/collection-use-cases";
import { collectionDeps } from "./collection-deps";
import { METHOD_LABELS, paymentConcept } from "./collection-labels";

const { green: GREEN, red: RED, muted: MUTED } = PDF_COLORS;

/** The receipt as Agrosoil prints it, with the balances of the moment it was issued (D26, D27). */
export function ReceiptPdf({ payment }: { payment: PaymentView }) {
  const amount = Money.parse(payment.amount, payment.currency);
  const number = formatDocumentNumber(payment.receiptNumber);
  const paidHow = [
    METHOD_LABELS[payment.method],
    payment.inKindDescription,
    payment.reference && `Ref.: ${payment.reference}`,
    payment.currency === "BOB" &&
      `Equivale a US$ ${formatMoney(payment.usdAmount)} a ${formatRate(payment.exchangeRate)} Bs por US$`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PdfFormPage title={`Recibo N.º ${number}`} watermark={payment.status === "voided" ? "ANULADO" : null}>
      <View style={{ borderWidth: 1.4, borderColor: RED, borderRadius: 10, padding: 2.5 }}>
        <View style={{ borderWidth: 0.7, borderColor: RED, borderRadius: 8, padding: 14, gap: 11 }}>
          {/* Letterhead */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
            <PdfLogo width={112} />
            <View style={{ flex: 1, alignItems: "center", paddingTop: 6 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 24, color: GREEN, letterSpacing: 1 }}>
                RECIBO
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontFamily: "Courier-Bold",
                  fontSize: 14,
                  color: RED,
                }}
              >
                Nº {number}
              </Text>
            </View>
            <View style={{ width: 140 }}>
              <AmountBox label="Bs." value={payment.currency === "BOB" ? formatMoney(payment.amount) : ""} />
              <AmountBox label="$us." value={payment.currency === "USD" ? formatMoney(payment.amount) : ""} />
            </View>
          </View>
          <View style={{ alignItems: "flex-end", fontSize: 7.5, color: MUTED }}>
            <Text>
              Facebook: {COMPANY.facebook} · {COMPANY.website}
            </Text>
            <Text>
              Of. {COMPANY.phone} · Cel. {COMPANY.mobile} · {COMPANY.email}
            </Text>
          </View>

          {/* Body */}
          <PdfBlank label="Recibí de:" value={payment.customer.name} />
          <PdfBlank label="La suma de:" value={amountInWords(amount)} />
          <PdfBlank label="Por concepto de:" value={paymentConcept(payment)} />
          <PdfBlank label="Forma de pago:" value={paidHow} />

          {/* Balances, in dollars like the debt (D27). */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 14, marginTop: 2 }}>
            <BalanceBox label="A cuenta US$:" value={formatMoney(payment.usdAmount)} />
            <BalanceBox
              label="Saldo US$:"
              value={payment.balance ? formatMoney(payment.balance.after) : "—"}
            />
            <BalanceBox
              label="Total US$:"
              value={payment.balance ? formatMoney(payment.balance.before) : "—"}
            />
          </View>

          <Text style={{ textAlign: "center", marginTop: 4, fontSize: 10 }}>
            {COMPANY.city}, {formatLongDate(payment.paymentDate)}
          </Text>

          {payment.observations && <PdfBlank label="Observaciones:" value={payment.observations} />}
          {payment.voided && <PdfBlank label="Motivo de la anulación:" value={payment.voided.reason} />}

          {/* Signatures */}
          <View style={{ flexDirection: "row", gap: 28, marginTop: 34 }}>
            <Signature
              title="Firma - Recibí Conforme"
              name={payment.recorded.byName}
              documentId={payment.recorded.documentId}
            />
            <Signature
              title="Firma - Entregué Conforme"
              name={payment.customer.name}
              documentId={payment.customer.taxId}
            />
          </View>
        </View>
      </View>
    </PdfFormPage>
  );
}

function AmountBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 }}>
      <Text style={{ width: 24, textAlign: "right", fontFamily: "Helvetica-Bold", color: GREEN }}>
        {label}
      </Text>
      <View
        style={{
          flex: 1,
          height: 24,
          justifyContent: "center",
          borderWidth: 1,
          borderColor: GREEN,
          borderRadius: 4,
          paddingHorizontal: 5,
        }}
      >
        <Text style={{ textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 11 }}>{value || " "}</Text>
      </View>
    </View>
  );
}

function BalanceBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1 }}>
      <Text>{label}</Text>
      <View
        style={{
          flex: 1,
          height: 22,
          justifyContent: "center",
          borderWidth: 1,
          borderColor: GREEN,
          borderRadius: 4,
          paddingHorizontal: 5,
        }}
      >
        <Text style={{ textAlign: "right", fontFamily: "Helvetica-Bold" }}>{value}</Text>
      </View>
    </View>
  );
}

function Signature({
  title,
  name,
  documentId,
}: {
  title: string;
  name: string | null;
  documentId: string | null;
}) {
  return (
    <View style={{ flex: 1, gap: 5 }}>
      <View style={{ borderTopWidth: 0.7, borderColor: "#555", paddingTop: 3 }}>
        <Text style={{ textAlign: "center" }}>{title}</Text>
      </View>
      <PdfBlank label="Nombre:" value={name} />
      <PdfBlank label="C.I.:" value={documentId} />
    </View>
  );
}

/** The receipt as a PDF, for administration; 404 when it doesn't exist. */
export async function receiptPdfResponse(paymentId: string): Promise<Response> {
  const actor = await requireActor();
  const payment = await getPayment(collectionDeps(getDb()), actor, paymentId).catch(notFoundAsNull);
  if (!payment) return new Response("No encontrado", { status: 404 });
  return pdfResponse(
    <ReceiptPdf payment={payment} />,
    `recibo-${formatDocumentNumber(payment.receiptNumber)}.pdf`,
  );
}
