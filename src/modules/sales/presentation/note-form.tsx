"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useFieldArray, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { campaignOn } from "@/modules/campaigns/domain/campaign";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { measureDelivered, measureOf } from "@/modules/catalog/domain/product";
import { contentLabel } from "@/modules/catalog/presentation/catalog-labels";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import { applyActionError } from "@/shared/presentation/form-errors";
import { formatMoney, formatQuantity, trimDecimalZeros } from "@/shared/presentation/format";
import { Button, buttonVariants } from "@/shared/presentation/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import { Textarea } from "@/shared/presentation/ui/textarea";
import { draftNoteSchema, type DraftNoteInput, type NoteLineInput } from "../application/note-schemas";
import { lineTotal } from "../domain/delivery-note";
import { createDraftNoteAction, updateDraftNoteAction } from "./note-actions";
import type { NoteFormOptions } from "./note-form-options";
import { NOTES_PATH, notePath } from "./note-routes";

const EMPTY_LINE: NoteLineInput = { presentationId: "", quantity: "", unitPrice: "", freeOfCharge: "" };

type Props = {
  options: NoteFormOptions;
  today: string;
  /** Present when editing a draft. */
  draft?: { id: string; values: DraftNoteInput };
};

export function NoteForm({ options, today, draft }: Props) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({
    resolver: zodResolver(draftNoteSchema),
    defaultValues:
      draft?.values ??
      ({
        noteDate: today,
        customerId: "",
        propertyId: "",
        technicianId: "",
        paymentTerms: "credit",
        exchangeRate: "",
        receiverName: "",
        receiverDocumentId: "",
        receiverRelationship: "",
        observations: "",
        taxInvoiceNumber: "",
        lines: [EMPTY_LINE],
      } satisfies DraftNoteInput),
  });
  const lines = useFieldArray({ control: form.control, name: "lines" });
  const { errors } = form.formState;
  const [noteDate, customerId, exchangeRate, watchedLines] = useWatch({
    control: form.control,
    name: ["noteDate", "customerId", "exchangeRate", "lines"],
  });

  const customer = options.customers.find((option) => option.id === customerId);
  const campaign = campaignOn(options.campaigns, noteDate ?? "");
  const presentationsById = new Map(
    options.presentations.map((presentation) => [presentation.id, presentation]),
  );

  function suggestedPrice(presentationId: string): string {
    if (!campaign) return "";
    const byZone = options.prices[campaign.id] ?? {};
    return byZone[customer?.zoneId ?? ""]?.[presentationId] ?? byZone[""]?.[presentationId] ?? "";
  }

  function chooseCustomer(id: string) {
    const chosen = options.customers.find((option) => option.id === id);
    form.setValue("propertyId", "");
    form.setValue("technicianId", chosen?.technicianId ?? "");
    if (chosen?.fixedExchangeRate) form.setValue("exchangeRate", trimDecimalZeros(chosen.fixedExchangeRate));
    if (chosen && !form.getValues("receiverName")) form.setValue("receiverName", chosen.name);
  }

  function chooseReceiver(receiverId: string) {
    const receiver = customer?.receivers.find((option) => option.id === receiverId);
    if (!receiver) return;
    form.setValue("receiverName", receiver.name);
    form.setValue("receiverDocumentId", receiver.documentId ?? "");
    form.setValue("receiverRelationship", receiver.relationship);
  }

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      if (draft) {
        const result = await updateDraftNoteAction(draft.id, values);
        if (!result.ok) return applyActionError(form, result.error);
        toast.success("Borrador guardado");
        router.push(notePath(draft.id));
      } else {
        const result = await createDraftNoteAction(values);
        if (!result.ok) return applyActionError(form, result.error);
        toast.success("Borrador guardado");
        router.push(notePath(result.data.id));
      }
    }),
  );

  const totals = noteTotals(watchedLines ?? [], presentationsById, exchangeRate ?? "");

  return (
    <form onSubmit={submit} noValidate className="flex max-w-5xl flex-col gap-8">
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field data-invalid={!!errors.noteDate}>
            <FieldLabel htmlFor="noteDate">Fecha</FieldLabel>
            <Input
              id="noteDate"
              type="date"
              aria-invalid={!!errors.noteDate}
              {...form.register("noteDate")}
            />
            <span className="text-xs text-muted-foreground">
              {campaign ? `Campaña ${campaignLabel(campaign)}` : "Sin campaña abierta para esta fecha"}
            </span>
            <FieldError errors={[errors.noteDate]} />
          </Field>
          <Field data-invalid={!!errors.customerId} className="sm:col-span-2">
            <FieldLabel htmlFor="customerId">Cliente</FieldLabel>
            <NativeSelect
              id="customerId"
              aria-invalid={!!errors.customerId}
              {...form.register("customerId", { onChange: (event) => chooseCustomer(event.target.value) })}
            >
              <NativeSelectOption value="">Elegir cliente…</NativeSelectOption>
              {options.customers.map((option) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {String(option.code).padStart(4, "0")} · {option.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError errors={[errors.customerId]} />
          </Field>
          <Field data-invalid={!!errors.propertyId}>
            <FieldLabel htmlFor="propertyId">Propiedad</FieldLabel>
            <NativeSelect
              id="propertyId"
              disabled={!customer?.properties.length}
              {...form.register("propertyId")}
            >
              <NativeSelectOption value="">
                {customer?.properties.length ? "Sin especificar" : "El cliente no tiene propiedades"}
              </NativeSelectOption>
              {customer?.properties.map((property) => (
                <NativeSelectOption key={property.id} value={property.id}>
                  {property.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError errors={[errors.propertyId]} />
          </Field>
          <Field data-invalid={!!errors.technicianId}>
            <FieldLabel htmlFor="technicianId">Técnico de venta</FieldLabel>
            <NativeSelect id="technicianId" {...form.register("technicianId")}>
              <NativeSelectOption value="">Sin técnico</NativeSelectOption>
              {options.technicians.map((technician) => (
                <NativeSelectOption key={technician.id} value={technician.id}>
                  {technician.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError errors={[errors.technicianId]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="paymentTerms">Pago</FieldLabel>
            <NativeSelect id="paymentTerms" {...form.register("paymentTerms")}>
              <NativeSelectOption value="credit">Crédito</NativeSelectOption>
              <NativeSelectOption value="cash">Contado</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field data-invalid={!!errors.exchangeRate}>
            <FieldLabel htmlFor="exchangeRate">Tipo de cambio (Bs por US$)</FieldLabel>
            <Input
              id="exchangeRate"
              inputMode="decimal"
              placeholder="6.96"
              aria-invalid={!!errors.exchangeRate}
              {...form.register("exchangeRate")}
            />
            <FieldError errors={[errors.exchangeRate]} />
          </Field>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">Productos</legend>
          {lines.fields.map((field, index) => {
            const line = watchedLines?.[index];
            const presentation = line ? presentationsById.get(line.presentationId) : undefined;
            const lineErrors = errors.lines?.[index];
            return (
              <div key={field.id} className="flex flex-wrap items-start gap-2 rounded-lg border p-3">
                <NativeSelect
                  className="min-w-64"
                  aria-label="Producto"
                  aria-invalid={!!lineErrors?.presentationId}
                  {...form.register(`lines.${index}.presentationId`, {
                    onChange: (event) =>
                      form.setValue(`lines.${index}.unitPrice`, suggestedPrice(event.target.value)),
                  })}
                >
                  <NativeSelectOption value="">Elegir producto…</NativeSelectOption>
                  {options.presentations.map((option) => (
                    <NativeSelectOption key={option.id} value={option.id}>
                      {option.productName} · {contentLabel(option)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Input
                  className="w-24 text-right"
                  inputMode="decimal"
                  placeholder="Cant."
                  aria-label="Cantidad"
                  aria-invalid={!!lineErrors?.quantity}
                  {...form.register(`lines.${index}.quantity`)}
                />
                <span className="self-center text-xs text-muted-foreground">
                  {presentation
                    ? presentation.saleUnit === "measure"
                      ? measureOf(presentation.unit) === "l"
                        ? "litros"
                        : "kilos"
                      : "envases"
                    : ""}
                </span>
                <Input
                  className="w-28 text-right"
                  inputMode="decimal"
                  placeholder="Precio US$"
                  aria-label="Precio"
                  aria-invalid={!!lineErrors?.unitPrice}
                  disabled={!!line?.freeOfCharge}
                  {...form.register(`lines.${index}.unitPrice`)}
                />
                <NativeSelect aria-label="Sin costo" {...form.register(`lines.${index}.freeOfCharge`)}>
                  <NativeSelectOption value="">Con precio</NativeSelectOption>
                  <NativeSelectOption value="bonus">Bonificación</NativeSelectOption>
                  <NativeSelectOption value="sample">Muestra</NativeSelectOption>
                </NativeSelect>
                <span className="ml-auto self-center font-medium tabular-nums">
                  {formatMoney(totalOf(line))}
                </span>
                {lines.fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Quitar producto"
                    onClick={() => lines.remove(index)}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                )}
                <FieldError
                  className="w-full"
                  errors={[lineErrors?.presentationId ?? lineErrors?.quantity ?? lineErrors?.unitPrice]}
                />
              </div>
            );
          })}
          <FieldError errors={[errors.lines?.root ?? errors.lines]} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => lines.append(EMPTY_LINE)}
          >
            <PlusIcon aria-hidden /> Otro producto
          </Button>
          <dl className="flex flex-wrap justify-end gap-x-8 gap-y-1 text-sm">
            <Total label="Total US$" value={totals.usd} />
            <Total label="Equivale a Bs" value={totals.bob} />
            {totals.liters && <Total label="Litros" value={totals.liters} />}
            {totals.kilos && <Total label="Kilos" value={totals.kilos} />}
          </dl>
        </fieldset>

        <ReceiverFields form={form} customer={customer} onChoose={chooseReceiver} />

        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <Field data-invalid={!!errors.observations}>
            <FieldLabel htmlFor="observations">Observaciones</FieldLabel>
            <Textarea id="observations" rows={2} {...form.register("observations")} />
            <FieldError errors={[errors.observations]} />
          </Field>
          <Field data-invalid={!!errors.taxInvoiceNumber}>
            <FieldLabel htmlFor="taxInvoiceNumber">N.º de factura SIN (opcional)</FieldLabel>
            <Input id="taxInvoiceNumber" {...form.register("taxInvoiceNumber")} />
            <FieldError errors={[errors.taxInvoiceNumber]} />
          </Field>
        </div>
      </FieldGroup>

      <FieldError errors={[errors.root]} />
      <div className="flex gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando…" : "Guardar borrador"}
        </Button>
        <Link href={draft ? notePath(draft.id) : NOTES_PATH} className={buttonVariants({ variant: "ghost" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function ReceiverFields({
  form,
  customer,
  onChoose,
}: {
  form: UseFormReturn<DraftNoteInput>;
  customer: NoteFormOptions["customers"][number] | undefined;
  onChoose: (receiverId: string) => void;
}) {
  const { errors } = form.formState;
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-sm font-medium">Quién recibe</legend>
      {!!customer?.receivers.length && (
        <NativeSelect
          className="max-w-sm"
          defaultValue=""
          onChange={(event) => onChoose(event.target.value)}
          aria-label="Persona autorizada"
        >
          <NativeSelectOption value="">Elegir persona autorizada…</NativeSelectOption>
          {customer.receivers.map((receiver) => (
            <NativeSelectOption key={receiver.id} value={receiver.id}>
              {receiver.name} ({receiver.relationship})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
      <div className="grid gap-5 sm:grid-cols-3">
        <Field data-invalid={!!errors.receiverName}>
          <FieldLabel htmlFor="receiverName">Nombre</FieldLabel>
          <Input id="receiverName" aria-invalid={!!errors.receiverName} {...form.register("receiverName")} />
          <FieldError errors={[errors.receiverName]} />
        </Field>
        <Field data-invalid={!!errors.receiverDocumentId}>
          <FieldLabel htmlFor="receiverDocumentId">CI</FieldLabel>
          <Input id="receiverDocumentId" {...form.register("receiverDocumentId")} />
          <FieldError errors={[errors.receiverDocumentId]} />
        </Field>
        <Field data-invalid={!!errors.receiverRelationship}>
          <FieldLabel htmlFor="receiverRelationship">Cargo o parentesco</FieldLabel>
          <Input
            id="receiverRelationship"
            placeholder="Titular, hijo, encargado…"
            {...form.register("receiverRelationship")}
          />
          <FieldError errors={[errors.receiverRelationship]} />
        </Field>
      </div>
    </fieldset>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** Line total while typing; invalid input counts as zero until the form is fixed. */
function totalOf(line: NoteLineInput | undefined): string {
  return lineMoney(line).toDecimalString();
}

function lineMoney(line: NoteLineInput | undefined): Money {
  try {
    if (!line?.quantity) return Money.zero();
    return lineTotal({
      quantity: Quantity.parse(line.quantity.replace(",", ".")),
      unitPrice: line.unitPrice ? Money.parse(line.unitPrice.replace(",", ".")) : Money.zero(),
      freeOfCharge: line.freeOfCharge || null,
    });
  } catch {
    return Money.zero();
  }
}

function noteTotals(
  lines: NoteLineInput[],
  presentations: Map<string, NoteFormOptions["presentations"][number]>,
  rate: string,
) {
  const usd = Money.sum(lines.map(lineMoney));
  let liters = Quantity.zero();
  let kilos = Quantity.zero();
  for (const line of lines) {
    const presentation = presentations.get(line.presentationId);
    if (!presentation || !line.quantity) continue;
    try {
      const measure = measureDelivered(
        {
          content: Quantity.parse(presentation.content),
          unit: presentation.unit,
          saleUnit: presentation.saleUnit,
        },
        Quantity.parse(line.quantity.replace(",", ".")),
      );
      if (measureOf(presentation.unit) === "l") liters = liters.add(measure);
      else kilos = kilos.add(measure);
    } catch {
      // Ignored until the quantity is valid.
    }
  }
  let bob = "—";
  try {
    if (rate) bob = formatMoney(ExchangeRate.parse(rate.replace(",", ".")).toBob(usd).toDecimalString());
  } catch {
    bob = "—";
  }
  return {
    usd: formatMoney(usd.toDecimalString()),
    bob,
    liters: liters.isZero() ? null : formatQuantity(liters.toDecimalString()),
    kilos: kilos.isZero() ? null : formatQuantity(kilos.toDecimalString()),
  };
}
