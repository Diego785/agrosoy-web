"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import { UnitPrice } from "@/shared/domain/unit-price";
import { applyActionError } from "@/shared/presentation/form-errors";
import {
  formatMoney,
  formatPrice,
  formatQuantity,
  priceInputValue,
  trimDecimalZeros,
} from "@/shared/presentation/format";
import { Button, buttonVariants } from "@/shared/presentation/ui/button";
import { Field, FieldError, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { Textarea } from "@/shared/presentation/ui/textarea";
import { correctImportedNoteSchema, type CorrectImportedNoteInput } from "../application/note-schemas";
import { correctImportedNoteAction } from "./note-actions";
import { notePath } from "./note-routes";

export type CorrectableLine = {
  id: string;
  label: string;
  /** "litros", "envases"… */
  quantityUnit: string;
  /** "litro", "envase"… */
  priceUnit: string;
  quantity: string;
  unitPrice: string;
  total: string;
};

/** What a line would total with what is typed; its original total until both read as numbers. */
function typedTotal(quantity: string | undefined, price: string | undefined, original: string): Money {
  try {
    return Quantity.parse((quantity ?? "").replace(",", ".")).times(
      UnitPrice.parse((price ?? "").replace(",", ".")),
    );
  } catch {
    return Money.parse(original);
  }
}

/** Correct each line's quantity and price of an imported note, with a reason (D60). */
export function NoteCorrectionForm({ noteId, lines }: { noteId: string; lines: CorrectableLine[] }) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({
    resolver: zodResolver(correctImportedNoteSchema),
    defaultValues: {
      reason: "",
      lines: lines.map((line) => ({
        lineId: line.id,
        quantity: trimDecimalZeros(line.quantity),
        unitPrice: priceInputValue(line.unitPrice),
      })),
    } satisfies CorrectImportedNoteInput,
  });
  const { errors } = form.formState;
  const watched = useWatch({ control: form.control, name: "lines" });
  const totals = lines.map((line, index) => {
    const typed = watched?.[index];
    const unchanged =
      typed?.quantity === trimDecimalZeros(line.quantity) &&
      typed?.unitPrice === priceInputValue(line.unitPrice);
    // An untouched line keeps the total it came with: the sheet's own (D60).
    return unchanged ? Money.parse(line.total) : typedTotal(typed?.quantity, typed?.unitPrice, line.total);
  });
  const before = Money.sum(lines.map((line) => Money.parse(line.total)));
  const after = Money.sum(totals);

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await correctImportedNoteAction(noteId, values);
      if (!result.ok) return applyActionError(form, result.error);
      toast.success("Boleta corregida");
      router.push(notePath(noteId));
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex max-w-4xl flex-col gap-6">
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="hidden grid-cols-[minmax(0,1fr)_8rem_9rem_7rem] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:grid">
          <span>Producto</span>
          <span className="text-right">Cantidad</span>
          <span className="text-right">Precio US$</span>
          <span className="text-right">Total US$</span>
        </div>
        {lines.map((line, index) => {
          const lineErrors = errors.lines?.[index];
          return (
            <div
              key={line.id}
              className="grid gap-3 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_8rem_9rem_7rem] sm:items-center"
            >
              <div className="min-w-0">
                <p className="font-medium">{line.label}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Antes: {formatQuantity(line.quantity)} × {formatPrice(line.unitPrice)} ={" "}
                  {formatMoney(line.total)}
                </p>
              </div>
              <Field data-invalid={!!lineErrors?.quantity}>
                <FieldLabel htmlFor={`quantity-${index}`} className="sm:sr-only">
                  Cantidad ({line.quantityUnit})
                </FieldLabel>
                <Input
                  id={`quantity-${index}`}
                  inputMode="decimal"
                  className="text-right"
                  aria-invalid={!!lineErrors?.quantity}
                  {...form.register(`lines.${index}.quantity`)}
                />
              </Field>
              <Field data-invalid={!!lineErrors?.unitPrice}>
                <FieldLabel htmlFor={`price-${index}`} className="sm:sr-only">
                  Precio US$ por {line.priceUnit}
                </FieldLabel>
                <Input
                  id={`price-${index}`}
                  inputMode="decimal"
                  className="text-right"
                  aria-invalid={!!lineErrors?.unitPrice}
                  {...form.register(`lines.${index}.unitPrice`)}
                />
              </Field>
              <p className="text-right font-medium tabular-nums">
                {formatMoney(totals[index]!.toDecimalString())}
              </p>
              <FieldError className="sm:col-span-4" errors={[lineErrors?.quantity, lineErrors?.unitPrice]} />
            </div>
          );
        })}
        <div className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-1 bg-muted/30 px-4 py-3 text-sm">
          <span className="text-muted-foreground tabular-nums">
            Antes US$ {formatMoney(before.toDecimalString())}
          </span>
          <span className="tabular-nums">
            Queda <span className="text-base font-semibold">US$ {formatMoney(after.toDecimalString())}</span>
          </span>
        </div>
      </div>
      <Field data-invalid={!!errors.reason}>
        <FieldLabel htmlFor="reason">Motivo</FieldLabel>
        <Textarea
          id="reason"
          placeholder="Por ejemplo: el técnico lo vendió a 36, no a 37"
          aria-invalid={!!errors.reason}
          {...form.register("reason")}
        />
        <FieldError errors={[errors.reason, errors.root]} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          Guardar corrección
        </Button>
        <Link href={notePath(noteId)} className={buttonVariants({ variant: "ghost" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
