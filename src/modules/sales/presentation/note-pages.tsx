import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "cn";
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
import { ChevronRightIcon, ClipboardListIcon, PencilIcon, SproutIcon } from "lucide-react";
import { EmptyState } from "@/shared/presentation/empty-state";
import { PdfActions } from "@/shared/presentation/pdf-actions";
import { CardField, CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import { ListPages, listHref, pageRows } from "@/shared/presentation/list-pages";
import { FormSectionSkeleton } from "@/shared/presentation/form-section";
import { LiveFilterForm } from "@/shared/presentation/live-filter-form";
import {
  CardListSkeleton,
  FiltersSkeleton,
  ListFooterSkeleton,
  Loading,
  Skeleton,
  TableSkeleton,
} from "@/shared/presentation/skeletons";
import { Badge } from "@/shared/presentation/ui/badge";
import { buttonVariants } from "@/shared/presentation/ui/button";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import type { NoteStatus } from "../application/note-ports";
import { listFollowUps } from "../application/note-follow-ups";
import type { NoteType } from "../domain/follow-up";
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
const STATUS_VARIANTS = {
  draft: "warning",
  confirmed: "success",
  voided: "destructive",
} as const satisfies Record<NoteStatus, string>;
const FREE_LABELS = { bonus: "Bonificación", sample: "Muestra" } as const;
export const TYPE_TITLES: Record<NoteType, string> = {
  delivery: "Boleta de entrega",
  return: "Devolución",
  campaign_transfer: "Traspaso de campaña",
};

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
  const list = await listNotes(notesDeps(), actor, {
    status: status || undefined,
    page: first(params.page),
    pages: first(params.pages),
  });
  const { items } = list;
  const nextNumber = await nextNoteNumber(notesDeps(), actor);

  return (
    <div className="flex flex-col gap-4">
      {can(actor, "notes.void") ? (
        <NextNumberForm nextNumber={nextNumber} />
      ) : (
        <p className="text-sm text-muted-foreground">La próxima boleta será la N.º {nextNumber}.</p>
      )}
      <LiveFilterForm action={NOTES_PATH} className="flex flex-wrap items-center gap-2">
        <NativeSelect name="status" defaultValue={status} aria-label="Estado">
          <NativeSelectOption value="">Todas</NativeSelectOption>
          <NativeSelectOption value="draft">Borradores</NativeSelectOption>
          <NativeSelectOption value="confirmed">Confirmadas</NativeSelectOption>
          <NativeSelectOption value="voided">Anuladas</NativeSelectOption>
        </NativeSelect>
      </LiveFilterForm>
      {items.length === 0 ? (
        <EmptyState icon={<ClipboardListIcon />} title="No hay boletas">
          {status ? "Prueba con otro estado." : undefined}
        </EmptyState>
      ) : (
        <>
          <WideOnly>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">N.º</TableHead>
                  <TableHead className="w-28">Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead className="text-right">Total US$</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Abrir</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows(list).map((note) => (
                  <TableRow key={note.id} className="group relative">
                    <TableCell className="tabular-nums">
                      {/* The link covers the row, so the whole row opens the note. */}
                      <Link
                        href={notePath(note.id)}
                        className={`font-medium group-hover:text-primary after:absolute after:inset-0 ${note.number ? "" : "text-muted-foreground"}`}
                      >
                        {note.number ?? "Sin número"}
                      </Link>
                      {note.type !== "delivery" && (
                        <span className="ml-2 text-xs text-muted-foreground">{TYPE_TITLES[note.type]}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDate(note.noteDate)}
                    </TableCell>
                    <TableCell className="font-medium">{note.customerName}</TableCell>
                    <TableCell className="text-muted-foreground">{paymentLabel(note.paymentTerms)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(note.total)}
                    </TableCell>
                    <TableCell>
                      <NoteStatusBadge status={note.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <ChevronRightIcon
                        className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </WideOnly>
          <CardList label="Boletas">
            {items.map((note) => (
              <CardListItem key={note.id} className="relative">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={notePath(note.id)}
                    className="min-w-0 truncate font-medium after:absolute after:inset-0"
                  >
                    {note.number ? `N.º ${note.number}` : "Sin número"} · {note.customerName}
                  </Link>
                  <NoteStatusBadge status={note.status} />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {note.type !== "delivery" && `${TYPE_TITLES[note.type]} · `}
                  {formatDate(note.noteDate)} · {paymentLabel(note.paymentTerms)}
                </span>
                <CardField label="Total US$">
                  <span className="font-medium">{formatMoney(note.total)}</span>
                </CardField>
              </CardListItem>
            ))}
          </CardList>
        </>
      )}
      <ListPages
        list={list}
        href={(paging) => listHref(NOTES_PATH, { status }, paging)}
        noun={["boleta", "boletas"]}
      />
    </div>
  );
}

/** The notes list while it loads, laid out like `NotesTable`. */
export function NotesTableSkeleton() {
  return (
    <Loading label="Cargando boletas">
      <Skeleton className="my-0.5 h-4 w-64 max-w-full" />
      <FiltersSkeleton search={false} selects={1} />
      <TableSkeleton
        columns={[
          { shape: "short", className: "w-28" },
          { shape: "short", className: "w-28" },
          { shape: "text" },
          { shape: "short" },
          { shape: "short", align: "right" },
          { shape: "badge" },
          { shape: "chevron", className: "w-10" },
        ]}
      />
      <CardListSkeleton lines={2} />
      <ListFooterSkeleton />
    </Loading>
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
  const isDelivery = note.type === "delivery";
  const followUps =
    isDelivery && note.status !== "draft" ? await listFollowUps(notesDeps(), actor, note.id) : [];

  const transport = [
    note.carrier.name,
    note.carrier.vehicle,
    note.carrier.documentId && `CI ${note.carrier.documentId}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <article className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b p-5">
          <div className="min-w-0">
            <h2>
              <span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {TYPE_TITLES[note.type]}
              </span>
              <span
                className={`mt-1 block text-2xl font-semibold tracking-tight tabular-nums ${note.number || note.imported ? "" : "text-muted-foreground"}`}
              >
                {note.imported
                  ? `N.º ${note.imported.sheetNumber ?? "—"} (de planilla)`
                  : note.number
                    ? `N.º ${note.number}`
                    : "Sin número"}
              </span>
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <NoteStatusBadge status={note.status} />
              <span className="tabular-nums">{formatDate(note.noteDate)}</span>
              <span aria-hidden>·</span>
              <span>Campaña {campaignLabel(note.campaign)}</span>
            </p>
            {note.original && (
              <p className="mt-2 text-sm">
                Sobre la{" "}
                <Link href={notePath(note.original.id)} className="font-medium hover:text-primary">
                  boleta N.º {note.original.number}
                </Link>{" "}
                de la campaña {campaignLabel(note.original.campaign)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            {canEdit && nextNumber !== null && (
              <>
                <ConfirmNoteButton
                  noteId={note.id}
                  total={total.toDecimalString()}
                  exchangeRate={note.exchangeRate}
                  isCash={note.paymentTerms === "cash"}
                  nextNumber={nextNumber}
                />
                <Link href={editNotePath(note.id)} className={buttonVariants({ variant: "outline" })}>
                  <PencilIcon aria-hidden />
                  Editar borrador
                </Link>
                <DiscardDraftButton noteId={note.id} />
              </>
            )}
            <PdfActions
              href={notePdfPath(note.id)}
              fileName={note.number ? `boleta-${note.number}.pdf` : "boleta-borrador.pdf"}
            />
            {canVoid && note.number !== null && <VoidNoteButton noteId={note.id} number={note.number} />}
          </div>
        </header>
        {note.voided && (
          <div className="border-b border-destructive/25 bg-destructive/5 px-5 py-3 text-sm">
            <p className="font-medium">
              Anulada el {formatDateTime(note.voided.at)}
              {note.voided.byName && ` por ${note.voided.byName}`}
            </p>
            <p className="mt-1 text-muted-foreground">Motivo: {note.voided.reason}</p>
          </div>
        )}
        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Cliente</p>
            <Link
              href={customerPath(note.customer.id)}
              className="mt-1 block text-base font-semibold hover:text-primary"
            >
              {note.customer.name}
            </Link>
            <p className="font-mono text-xs text-muted-foreground">
              {formatCustomerCode(note.customer.code)}
            </p>
          </div>
          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
            <Item label="Propiedad">{note.property?.name}</Item>
            <Item label="Técnico de venta">{note.technician?.name}</Item>
            {isDelivery && <Item label="Pago">{paymentLabel(note.paymentTerms)}</Item>}
            <Item label="Tipo de cambio">
              <span className="tabular-nums">{formatRate(note.exchangeRate)}</span> Bs por US$
            </Item>
            {isDelivery && <Item label="Factura SIN">{note.taxInvoiceNumber}</Item>}
            {note.confirmed && (
              <Item label="Confirmada">
                {formatDateTime(note.confirmed.at)}
                {note.confirmed.byName && ` por ${note.confirmed.byName}`}
              </Item>
            )}
          </dl>
        </div>
      </article>

      <section aria-labelledby="note-lines" className="flex flex-col gap-3">
        <h3 id="note-lines" className="text-sm font-semibold">
          Productos
        </h3>
        <WideOnly>
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
                    <span className="font-medium">{line.productName}</span>{" "}
                    <span className="text-muted-foreground">· {contentLabel(line)}</span>
                    {line.freeOfCharge && (
                      <Badge variant="info" className="ml-2">
                        {FREE_LABELS[line.freeOfCharge]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatQuantity(line.quantity)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.freeOfCharge ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <>
                        {formatMoney(line.unitPrice)}{" "}
                        <span className="text-xs text-muted-foreground">por {priceUnitLabel(line)}</span>
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(line.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </WideOnly>
        <CardList label="Productos">
          {note.lines.map((line, index) => (
            <CardListItem key={index}>
              <span>
                <span className="font-medium">{line.productName}</span>{" "}
                <span className="text-muted-foreground">· {contentLabel(line)}</span>
                {line.freeOfCharge && (
                  <Badge variant="info" className="ml-2">
                    {FREE_LABELS[line.freeOfCharge]}
                  </Badge>
                )}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatQuantity(line.quantity)}
                {line.freeOfCharge ? "" : ` × ${formatMoney(line.unitPrice)} por ${priceUnitLabel(line)}`}
              </span>
              <CardField label="Total US$">
                <span className="font-medium">{formatMoney(line.total)}</span>
              </CardField>
            </CardListItem>
          ))}
        </CardList>
        <dl className="flex flex-col gap-1 self-end rounded-xl border bg-card px-5 py-4 shadow-xs sm:min-w-72">
          <div className="flex items-baseline justify-between gap-6">
            <dt className="text-sm text-muted-foreground">Total US$</dt>
            <dd className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatMoney(total.toDecimalString())}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-6 text-sm">
            <dt className="text-muted-foreground">Equivale a Bs</dt>
            <dd className="font-medium tabular-nums">{formatMoney(bob.toDecimalString())}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="note-delivery" className="rounded-xl border bg-card shadow-xs">
        <h3 id="note-delivery" className="border-b px-5 py-3 text-sm font-semibold">
          {isDelivery ? "Entrega" : "Quién entrega y recibe"}
        </h3>
        <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-3">
          <Item label={note.type === "return" ? "Devuelve" : "Recibe"}>
            {note.receiver.name}
            {(note.receiver.relationship || note.receiver.documentId) && (
              <span className="block text-xs font-normal text-muted-foreground">
                {[note.receiver.relationship, note.receiver.documentId && `CI ${note.receiver.documentId}`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </Item>
          {/* On a return the customer's person hands over and Agrosoil's receives (D26). */}
          <Item label={isDelivery ? "Entrega" : "Recibe (Agrosoil)"}>
            {note.handedOverBy && (
              <>
                {note.handedOverBy.name}
                {note.handedOverBy.position && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {note.handedOverBy.position}
                  </span>
                )}
              </>
            )}
          </Item>
          <Item label="Transporte">{transport}</Item>
          <Item label="Observaciones" className="sm:col-span-3">
            {note.observations && (
              <span className="font-normal whitespace-pre-line">{note.observations}</span>
            )}
          </Item>
        </dl>
      </section>

      {followUps.length > 0 && (
        <section aria-labelledby="note-follow-ups" className="rounded-xl border bg-card shadow-xs">
          <h3 id="note-follow-ups" className="border-b px-5 py-3 text-sm font-semibold">
            Devoluciones y traspasos
          </h3>
          <ul className="divide-y text-sm">
            {followUps.map((followUp) => (
              <li key={followUp.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 py-3">
                <Link href={notePath(followUp.id)} className="font-medium hover:text-primary">
                  {TYPE_TITLES[followUp.type]} N.º {followUp.number}
                </Link>
                <span className="text-muted-foreground tabular-nums">{formatDate(followUp.noteDate)}</span>
                {followUp.status === "voided" && <Badge variant="destructive">Anulada</Badge>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** A note while it loads: header card, products with their total, and delivery, like `NoteDetail`. */
export function NoteDetailSkeleton() {
  return (
    <Loading label="Cargando boleta" className="max-w-5xl gap-6">
      <div aria-hidden className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="flex flex-col gap-2 border-b p-5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-36" />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>
        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
            {[0, 1, 2, 3, 4].map((index) => (
              <ItemSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>

      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton className="my-0.5 h-4 w-20" />
        <TableSkeleton
          rows={3}
          columns={[
            { shape: "text" },
            { shape: "short", align: "right" },
            { shape: "text", align: "right" },
            { shape: "short", align: "right" },
          ]}
        />
        <CardListSkeleton rows={3} lines={2} />
        <div className="flex w-full max-w-72 flex-col gap-1 self-end rounded-xl border bg-card px-5 py-4 shadow-xs sm:min-w-72">
          <div className="flex h-8 items-center justify-between gap-6">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-7 w-28" />
          </div>
          <div className="flex h-5 items-center justify-between gap-6">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        </div>
      </div>

      <div aria-hidden className="rounded-xl border bg-card shadow-xs">
        <div className="border-b px-5 py-3.5">
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-3">
          <ItemSkeleton />
          <ItemSkeleton />
          <ItemSkeleton />
          <ItemSkeleton className="sm:col-span-3" />
        </div>
      </div>
    </Loading>
  );
}

export async function NewNote() {
  const actor = await requireActor();
  const options = await loadNoteFormOptions(actor);
  if (options.campaigns.length === 0) {
    return (
      <EmptyState icon={<SproutIcon />} title="Sin campaña actual">
        Primero crea la campaña actual en Campañas.
      </EmptyState>
    );
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
          handedOverById: note.handedOverBy?.id ?? "",
          carrierName: note.carrier.name ?? "",
          carrierVehicle: note.carrier.vehicle ?? "",
          carrierDocumentId: note.carrier.documentId ?? "",
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

/** The note form while its options load: the same five cards and buttons as `NoteForm`. */
export function NoteFormSkeleton() {
  return (
    <Loading label="Cargando formulario de boleta" className="max-w-5xl gap-6">
      <FormSectionSkeleton>
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <FieldSkeleton />
            <Skeleton className="my-0.5 h-3 w-32" />
          </div>
          <FieldSkeleton className="sm:col-span-2" />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
      </FormSectionSkeleton>

      <FormSectionSkeleton>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
          <Skeleton className="h-9 w-64 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
        <Skeleton className="h-7 w-32 rounded-lg" />
        <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-2 border-t pt-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-36" />
        </div>
      </FormSectionSkeleton>

      <FormSectionSkeleton>
        <div className="grid gap-5 sm:grid-cols-3">
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
      </FormSectionSkeleton>

      <FormSectionSkeleton>
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
          <FieldSkeleton />
          <div className="flex flex-col gap-3">
            <Skeleton className="mb-2 h-3.5 w-36" />
            <div className="grid gap-5 sm:grid-cols-3">
              <FieldSkeleton />
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
          </div>
        </div>
      </FormSectionSkeleton>

      <FormSectionSkeleton>
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <FieldSkeleton tall />
          <FieldSkeleton />
        </div>
      </FormSectionSkeleton>

      <div aria-hidden className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
    </Loading>
  );
}

function FieldSkeleton({ className, tall = false }: { className?: string; tall?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Skeleton className="my-0.5 h-3.5 w-24" />
      <Skeleton className={cn("w-full rounded-lg", tall ? "h-16" : "h-9")} />
    </div>
  );
}

/** An `Item` of the note's facts: a small label over its value. */
function ItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Skeleton className="my-0.5 h-3 w-20" />
      <Skeleton className="my-0.5 h-4 w-32" />
    </div>
  );
}

function Item({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-medium">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function NoteStatusBadge({ status }: { status: NoteStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>;
}

function paymentLabel(terms: string): string {
  return terms === "cash" ? "Contado" : "Crédito";
}
