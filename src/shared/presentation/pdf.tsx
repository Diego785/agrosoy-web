import "server-only";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { ReactElement, ReactNode } from "react";
import { formatDateTime } from "./format";

// Building blocks for the documents Agrosoil prints or shares (notes, receipts, statements; D12).
// Helvetica covers the Spanish characters used (á, ñ, º); no logo until Agrosoil provides one.

export const pdfStyles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontSize: 9, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  title: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "right" },
  subtitle: { fontSize: 9, color: "#555", textAlign: "right", marginTop: 2 },
  stamp: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#b42318",
    textAlign: "right",
  },
  fields: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  field: { width: "50%", marginBottom: 6, paddingRight: 8 },
  label: { fontSize: 7, color: "#666", textTransform: "uppercase", marginBottom: 1 },
  value: { fontSize: 9 },
  table: { borderTopWidth: 1, borderColor: "#999", marginBottom: 12 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ccc", paddingVertical: 3 },
  headRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#999", paddingVertical: 3 },
  headCell: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: "#444" },
  totalRow: { flexDirection: "row", paddingVertical: 4 },
  bold: { fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
  muted: { color: "#666" },
  signatures: { flexDirection: "row", justifyContent: "space-between", marginTop: 48 },
  signature: { width: "40%", borderTopWidth: 0.5, borderColor: "#333", paddingTop: 4, textAlign: "center" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7, color: "#888" },
});

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
    <Document title={title} author="Agrosoil" creator="Agrosoil">
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.brand}>AGROSOY</Text>
          <View>
            <Text style={pdfStyles.title}>{title}</Text>
            {subtitle && <Text style={pdfStyles.subtitle}>{subtitle}</Text>}
            {stamp && <Text style={pdfStyles.stamp}>{stamp}</Text>}
          </View>
        </View>
        {children}
        <Text
          style={pdfStyles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Generado el ${formatDateTime(new Date())} · Página ${pageNumber} de ${totalPages}`
          }
        />
      </Page>
    </Document>
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
