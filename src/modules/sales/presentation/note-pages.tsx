import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { contentLabel, priceUnitLabel } from "@/modules/catalog/presentation/catalog-labels";
import { formatCustomerCode } from "@/modules/customers/domain/customer";
import { customerPath } from "@/modules/customers/presentation/customer-routes";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { can } from "@/shared/application/permissions";
import { isDomainError } from "@/shared/domain/domain-error";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { getDb } from "@/shared/infrastructure/db/client";
import { todayInBolivia } from "@/shared/presentation/business-date";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  formatRate,
  trimDecimalZeros,
} from "@/shared/presentation/format";
import { PdfActions } from "@/shared/presentation/pdf-actions";
import { Badge } from "@/shared/presentation/ui/badge";
import { buttonVariants } from "@/shared/presentation/ui/button";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import type { NoteStatus } from "../application/note-ports";
import { nextNoteNumber } from "../application/note-lifecycle";
import { getNote, listNotes } from "../application/note-use-cases";
import { DiscardDraftButton } from "./discard-draft-button";
import { ConfirmNoteButton, NextNumberForm, VoidNoteButton } from "./note-lifecycle-forms";
import { NoteForm } from "./note-form";
import { noteDeps } from "./note-deps";
import { loadNoteFormOptions } from "./note-form-options";
import { NOTES_PATH, editNotePath, notePath, notePdfPath } from "./note-routes";

const STATUS_LABELS: Record<NoteStatus, string> = {
  draft: "Borrador",
  confirmed: "Confirmada",
  voided: "Anulada",
};
const FREE_LABELS = { bonus: "Bonificación", sample: "Muestra" } as const;

const notesDeps = () => noteDeps(getDb());
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export async function NotesTable({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const actor = await requireActor();
  const status = first(params.status) ?? "";
  const { items, total } = await listNotes(notesDeps(), actor, {
    status: status || undefined,
    page: first(params.page),
  });
  const nextNumber = await nextNoteNumber(notesDeps(), actor);

  return (
    <div className="flex flex-col gap-4">
      {can(actor, "notes.void") ? (
        <NextNumberForm nextNumber={nextNumber} />
      ) : (
        <p className="text-sm text-muted-foreground">La próxima boleta será la N.º {nextNumber}.</p>
      )}
      <form action={NOTES_PATH} className="flex gap-2">
        <NativeSelect name="status" defaultValue={status} aria-label="Estado">
          <NativeSelectOption value="">Todas</NativeSelectOption>
          <NativeSelectOption value="draft">Borradores</NativeSelectOption>
          <NativeSelectOption value="confirmed">Confirmadas</NativeSelectOption>
          <NativeSelectOption value="voided">Anuladas</NativeSelectOption>
        </NativeSelect>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Filtrar
        </button>
      </form>
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No hay boletas.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">N.º</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead className="text-right">Total US$</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((note) => (
              <TableRow key={note.id}>
                <TableCell className="tabular-nums">
                  <Link href={notePath(note.id)} className="font-medium hover:underline">
                    {note.number ?? "Sin número"}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">{formatDate(note.noteDate)}</TableCell>
                <TableCell>{note.customerName}</TableCell>
                <TableCell>{note.paymentTerms === "cash" ? "Contado" : "Crédito"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(note.total)}</TableCell>
                <TableCell>
                  <Badge variant={note.status === "draft" ? "outline" : "secondary"}>
                    {STATUS_LABELS[note.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="text-sm text-muted-foreground">{total === 1 ? "1 boleta" : `${total} boletas`}</p>
    </div>
  );
}

async function loadNote(params: Promise<{ id: string }>) {
  const { id } = await params;
  const actor = await requireActor();
  const note = await getNote(notesDeps(), actor, id).catch((error: unknown) => {
    if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED"))
      notFound();
    throw error;
  });
  return {
    note,
    canEdit: note.status === "draft" && can(actor, "notes.manage"),
    canVoid: note.status === "confirmed" && can(actor, "notes.void"),
    actor,
  };
}

export async function NoteDetail({ params }: { params: Promise<{ id: string }> }) {
  const { note, canEdit, canVoid, actor } = await loadNote(params);
  const total = Money.sum(note.lines.map((line) => Money.parse(line.total)));
  const bob = ExchangeRate.parse(note.exchangeRate).toBob(total);
  const nextNumber = canEdit ? await nextNoteNumber(notesDeps(), actor) : null;

  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            Boleta de entrega {note.number ? `N.º ${note.number}` : "(borrador)"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(note.noteDate)} · Campaña {campaignLabel(note.campaign)} ·{" "}
            <Badge variant={note.status === "draft" ? "outline" : "secondary"}>
              {STATUS_LABELS[note.status]}
            </Badge>
          </p>
        </div>
        {canEdit && nextNumber !== null && (
          <div className="flex gap-2">
            <ConfirmNoteButton
              noteId={note.id}
              total={total.toDecimalString()}
              exchangeRate={note.exchangeRate}
              isCash={note.paymentTerms === "cash"}
              nextNumber={nextNumber}
            />
            <Link href={editNotePath(note.id)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Editar
            </Link>
            <DiscardDraftButton noteId={note.id} />
          </div>
        )}
        <div className="flex gap-2">
          <PdfActions
            href={notePdfPath(note.id)}
            fileName={note.number ? `boleta-${note.number}.pdf` : "boleta-borrador.pdf"}
          />
          {canVoid && note.number !== null && <VoidNoteButton noteId={note.id} number={note.number} />}
        </div>
      </header>

      {note.voided && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          <p className="font-medium">
            Anulada el {formatDateTime(note.voided.at)}
            {note.voided.byName && ` por ${note.voided.byName}`}
          </p>
          <p className="mt-1 text-muted-foreground">Motivo: {note.voided.reason}</p>
        </div>
      )}

      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
        <Item label="Cliente">
          <Link href={customerPath(note.customer.id)} className="hover:underline">
            {formatCustomerCode(note.customer.code)} · {note.customer.name}
          </Link>
        </Item>
        <Item label="Propiedad">{note.property?.name}</Item>
        <Item label="Técnico de venta">{note.technician?.name}</Item>
        <Item label="Pago">{note.paymentTerms === "cash" ? "Contado" : "Crédito"}</Item>
        <Item label="Tipo de cambio">{formatRate(note.exchangeRate)} Bs por US$</Item>
        <Item label="Factura SIN">{note.taxInvoiceNumber}</Item>
        <Item label="Recibe">
          {note.receiver.name}
          {note.receiver.relationship && ` (${note.receiver.relationship})`}
          {note.receiver.documentId && ` · CI ${note.receiver.documentId}`}
        </Item>
        <Item label="Observaciones">{note.observations}</Item>
        {note.confirmed && (
          <Item label="Confirmada">
            {formatDateTime(note.confirmed.at)}
            {note.confirmed.byName && ` por ${note.confirmed.byName}`}
          </Item>
        )}
      </dl>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="text-right">Precio US$</TableHead>
            <TableHead className="text-right">Total US$</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {note.lines.map((line, index) => (
            <TableRow key={index}>
              <TableCell>
                {line.productName} · {contentLabel(line)}
                {line.freeOfCharge && (
                  <Badge variant="outline" className="ml-2">
                    {FREE_LABELS[line.freeOfCharge]}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatQuantity(line.quantity)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {line.freeOfCharge ? "—" : `${formatMoney(line.unitPrice)} por ${priceUnitLabel(line)}`}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(line.total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total (Bs {formatMoney(bob.toDecimalString())})</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatMoney(total.toDecimalString())}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

export async function NewNote() {
  const actor = await requireActor();
  const options = await loadNoteFormOptions(actor);
  if (options.campaigns.length === 0) {
    return <p className="text-sm text-muted-foreground">Primero crea la campaña actual en Campañas.</p>;
  }
  return <NoteForm options={options} today={todayInBolivia()} />;
}

export async function EditNote({ params }: { params: Promise<{ id: string }> }) {
  const { note, canEdit } = await loadNote(params);
  if (!canEdit) notFound();
  const actor = await requireActor();
  const options = await loadNoteFormOptions(actor);
  return (
    <NoteForm
      options={options}
      today={todayInBolivia()}
      draft={{
        id: note.id,
        values: {
          noteDate: note.noteDate,
          customerId: note.customer.id,
          propertyId: note.property?.id ?? "",
          technicianId: note.technician?.id ?? "",
          paymentTerms: note.paymentTerms,
          exchangeRate: trimDecimalZeros(note.exchangeRate),
          receiverName: note.receiver.name,
          receiverDocumentId: note.receiver.documentId ?? "",
          receiverRelationship: note.receiver.relationship ?? "",
          observations: note.observations ?? "",
          taxInvoiceNumber: note.taxInvoiceNumber ?? "",
          lines: note.lines.map((line) => ({
            presentationId: line.presentationId,
            quantity: trimDecimalZeros(line.quantity),
            unitPrice: line.freeOfCharge ? "" : line.unitPrice,
            freeOfCharge: line.freeOfCharge ?? "",
          })),
        },
      }}
    />
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children || "—"}</dd>
    </div>
  );
}
