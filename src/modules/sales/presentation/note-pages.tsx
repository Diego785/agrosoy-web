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
  formatMoney,
  formatQuantity,
  formatRate,
  trimDecimalZeros,
} from "@/shared/presentation/format";
import { ChevronRightIcon, ClipboardListIcon, PencilIcon, SproutIcon } from "lucide-react";
import { EmptyState } from "@/shared/presentation/empty-state";
import { CardField, CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import { ListPages, listHref, pageRows } from "@/shared/presentation/list-pages";
import { LiveFilterForm } from "@/shared/presentation/live-filter-form";
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
import type { NoteStatus, NoteView } from "../application/note-ports";
import { getNote, listNotes } from "../application/note-use-cases";
import { drizzleNoteRepository } from "../infrastructure/drizzle-note-repository";
import { DiscardDraftButton } from "./discard-draft-button";
import { NoteForm } from "./note-form";
import { loadNoteFormOptions } from "./note-form-options";
import { NOTES_PATH, editNotePath, notePath } from "./note-routes";

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

const notesDeps = () => ({ notes: drizzleNoteRepository(getDb()) });
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

  return (
    <div className="flex flex-col gap-4">
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

async function loadNote(params: Promise<{ id: string }>): Promise<{ note: NoteView; canEdit: boolean }> {
  const { id } = await params;
  const actor = await requireActor();
  const note = await getNote(notesDeps(), actor, id).catch((error: unknown) => {
    if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED"))
      notFound();
    throw error;
  });
  return { note, canEdit: note.status === "draft" && can(actor, "notes.manage") };
}

export async function NoteDetail({ params }: { params: Promise<{ id: string }> }) {
  const { note, canEdit } = await loadNote(params);
  const total = Money.sum(note.lines.map((line) => Money.parse(line.total)));
  const bob = ExchangeRate.parse(note.exchangeRate).toBob(total);

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
                Boleta de entrega
              </span>
              <span
                className={`mt-1 block text-2xl font-semibold tracking-tight tabular-nums ${note.number ? "" : "text-muted-foreground"}`}
              >
                {note.number ? `N.º ${note.number}` : "Sin número"}
              </span>
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <NoteStatusBadge status={note.status} />
              <span className="tabular-nums">{formatDate(note.noteDate)}</span>
              <span aria-hidden>·</span>
              <span>Campaña {campaignLabel(note.campaign)}</span>
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Link href={editNotePath(note.id)} className={buttonVariants({ variant: "outline" })}>
                <PencilIcon aria-hidden />
                Editar borrador
              </Link>
              <DiscardDraftButton noteId={note.id} />
            </div>
          )}
        </header>
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
            <Item label="Pago">{paymentLabel(note.paymentTerms)}</Item>
            <Item label="Tipo de cambio">
              <span className="tabular-nums">{formatRate(note.exchangeRate)}</span> Bs por US$
            </Item>
            <Item label="Factura SIN">{note.taxInvoiceNumber}</Item>
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
          Entrega
        </h3>
        <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-3">
          <Item label="Recibe">
            {note.receiver.name}
            {(note.receiver.relationship || note.receiver.documentId) && (
              <span className="block text-xs font-normal text-muted-foreground">
                {[note.receiver.relationship, note.receiver.documentId && `CI ${note.receiver.documentId}`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </Item>
          <Item label="Entrega">
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
    </div>
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
