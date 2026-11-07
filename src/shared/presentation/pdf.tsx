import "server-only";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { ReactElement, ReactNode } from "react";
import { AGROSOIL_LOGO_PNG } from "./brand/agrosoil-logo-data";
import { COMPANY } from "./company-profile";
import { formatDateTime } from "./format";

// Building blocks for the documents Agrosoil prints or shares (notes, receipts, statements; D12, D26).
// Helvetica covers the Spanish characters used (á, ñ, º).

/** The colors of Agrosoil's printed forms. */
export const PDF_COLORS = {
  green: "#0b8135",
  orange: "#e76b08",
  red: "#b42318",
  tan: "#f3e0cf",
  rule: "#e6c4ad",
  ink: "#222222",
  muted: "#666666",
} as const;

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: PDF_COLORS.ink,
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 66, height: 45 },
  company: { fontSize: 7.5, color: PDF_COLORS.muted, lineHeight: 1.35 },
  companyName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: PDF_COLORS.green, marginBottom: 1 },
  title: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "right" },
  subtitle: { fontSize: 9, color: "#555", textAlign: "right", marginTop: 2 },
  stamp: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.red,
    textAlign: "right",
  },
  fields: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  field: { width: "50%", marginBottom: 6, paddingRight: 8 },
  label: { fontSize: 7, color: PDF_COLORS.muted, textTransform: "uppercase", marginBottom: 1 },
  value: { fontSize: 9 },
  table: { borderTopWidth: 1, borderColor: "#999", marginBottom: 12 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ccc", paddingVertical: 3 },
  headRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#999", paddingVertical: 3 },
  headCell: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: "#444" },
  totalRow: { flexDirection: "row", paddingVertical: 4 },
  bold: { fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
  muted: { color: PDF_COLORS.muted },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7, color: "#888" },
  watermarkBox: {
    position: "absolute",
    top: 150,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  watermark: {
    fontSize: 44,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.red,
    opacity: 0.22,
    transform: "rotate(-14deg)",
  },
});

function GeneratedFooter() {
  return (
    <Text
      style={pdfStyles.footer}
      fixed
      render={({ pageNumber, totalPages }) =>
        `Generado el ${formatDateTime(new Date())} · Página ${pageNumber} de ${totalPages}`
      }
    />
  );
}

/** A page with the company's letterhead, for documents with no paper form of their own. */
export function PdfPage({
  title,
  subtitle,
  stamp,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Shown in red under the title, e.g. "ANULADA" or "BORRADOR". */
  stamp?: string | null;
  children: ReactNode;
}) {
  return (
    <Document title={title} author={COMPANY.brand} creator={COMPANY.brand}>
      <Page size="LETTER" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <View style={pdfStyles.brand}>
            {/* react-pdf's Image takes no alt text; the PDF's text names the company. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={AGROSOIL_LOGO_PNG} style={pdfStyles.logo} />
            <View>
              <Text style={pdfStyles.companyName}>{COMPANY.brand}</Text>
              <Text style={pdfStyles.company}>
                NIT {COMPANY.taxId} · Telf. {COMPANY.phone}
              </Text>
              <Text style={pdfStyles.company}>
                {COMPANY.email} · {COMPANY.city} - {COMPANY.country}
              </Text>
            </View>
          </View>
          <View>
            <Text style={pdfStyles.title}>{title}</Text>
            {subtitle && <Text style={pdfStyles.subtitle}>{subtitle}</Text>}
            {stamp && <Text style={pdfStyles.stamp}>{stamp}</Text>}
          </View>
        </View>
        {children}
        <GeneratedFooter />
      </Page>
    </Document>
  );
}

/** A page for a document that draws its own form, like the note and the receipt (D26). */
export function PdfFormPage({
  title,
  watermark,
  children,
}: {
  title: string;
  /** Printed across the form when it has no value: "ANULADA", "BORRADOR". */
  watermark?: string | null;
  children: ReactNode;
}) {
  return (
    <Document title={title} author={COMPANY.brand} creator={COMPANY.brand}>
      <Page size="LETTER" style={pdfStyles.page}>
        {children}
        {watermark && (
          <View style={pdfStyles.watermarkBox} fixed>
            <Text style={pdfStyles.watermark}>{watermark}</Text>
          </View>
        )}
        <GeneratedFooter />
      </Page>
    </Document>
  );
}

/** The logo, for the forms that place it themselves. */
export function PdfLogo({ width }: { width: number }) {
  // The logo's proportions, so it is never stretched.
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image src={AGROSOIL_LOGO_PNG} style={{ width, height: width * 0.688 }} />;
}

/**
 * "Cliente: ......." with its value over a dotted line, as the paper forms write it. Alone it is one
 * full line; beside others, `flex` is its share of the row.
 */
export function PdfBlank({
  label,
  value,
  labelColor = PDF_COLORS.ink,
  flex,
}: {
  label: string;
  value?: string | null;
  labelColor?: string;
  flex?: number;
}) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "flex-end", gap: 3 }, flex ? { flex } : {}]}>
      <Text style={{ color: labelColor }}>{label}</Text>
      <View
        style={{
          flex: 1,
          borderBottomWidth: 0.6,
          borderBottomStyle: "dotted",
          borderColor: "#777",
          minHeight: 12,
          paddingBottom: 1,
        }}
      >
        <Text style={{ fontFamily: "Helvetica-Bold" }}>{value || " "}</Text>
      </View>
    </View>
  );
}

/** A printed checkbox, marked when it applies. */
export function PdfCheck({ label, checked, color }: { label: string; checked: boolean; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderWidth: 0.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, lineHeight: 1 }}>
          {checked ? "X" : " "}
        </Text>
      </View>
      <Text style={{ color, fontFamily: "Helvetica-Bold" }}>{label}</Text>
    </View>
  );
}

export function PdfFields({ items }: { items: [label: string, value: string | null | undefined][] }) {
  return (
    <View style={pdfStyles.fields}>
      {items.map(([label, value]) => (
        <View key={label} style={pdfStyles.field}>
          <Text style={pdfStyles.label}>{label}</Text>
          <Text style={pdfStyles.value}>{value || "—"}</Text>
        </View>
      ))}
    </View>
  );
}

export type PdfColumn = { header: string; width: string; align?: "right" };

/** A simple table: column widths in percent, cells as text. */
export function PdfTable({
  columns,
  rows,
  footer,
}: {
  columns: PdfColumn[];
  rows: string[][];
  footer?: string[];
}) {
  const cell = (column: PdfColumn | undefined) => ({
    width: column?.width ?? "auto",
    paddingRight: 4,
    ...(column?.align === "right" ? pdfStyles.right : {}),
  });
  return (
    <View style={pdfStyles.table}>
      <View style={pdfStyles.headRow} fixed>
        {columns.map((column) => (
          <Text key={column.header} style={[pdfStyles.headCell, cell(column)]}>
            {column.header}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={pdfStyles.row} wrap={false}>
          {row.map((value, index) => (
            <Text key={index} style={cell(columns[index])}>
              {value}
            </Text>
          ))}
        </View>
      ))}
      {footer && (
        <View style={pdfStyles.totalRow}>
          {footer.map((value, index) => (
            <Text key={index} style={[pdfStyles.bold, cell(columns[index])]}>
              {value}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/** The PDF as an HTTP response, shown in the browser and named for saving or sharing. */
export async function pdfResponse(document: ReactElement, fileName: string): Promise<Response> {
  // Our document components render a <Document> at their root, which is what react-pdf expects.
  const buffer = await renderToBuffer(document as ReactElement<DocumentProps>);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
