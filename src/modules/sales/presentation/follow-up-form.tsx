"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import { applyActionError } from "@/shared/presentation/form-errors";
import { formatMoney, formatQuantity } from "@/shared/presentation/format";
import { Button, buttonVariants } from "@/shared/presentation/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import { Textarea } from "@/shared/presentation/ui/textarea";
import type { ReturnInput, TransferInput } from "../application/note-schemas";
import { registerReturnAction, registerTransferAction } from "./note-actions";
import { notePath } from "./note-routes";
import { DateInput } from "@/shared/presentation/date-input";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

export type FollowUpFormLine = {
  id: string;
  label: string;
  /** What the note delivered and what is left after confirmed returns and transfers. */
  delivered: string;
  remaining: string;
  unitPrice: string;
  isFree: boolean;
  /** Transfers: the reference price in the new campaign, if there is one. */
  suggestedPrice: string;
};

type Values = {
  noteDate: string;
  receiverName: string;
  exchangeRate: string;
  observations: string;
  paperNumber: string;
  lines: { originalLineId: string; quantity: string; unitPrice: string }[];
};

/**
 * Returns and campaign transfers share this form: one row per delivered line with what is left,
 * and the quantity to give back or move (prices too, for a transfer).
 */
export const FollowUpForm = resetOnLeave(function FollowUpForm({
  mode,
  noteId,
  lines,
  today,
  defaults,
}: {
  mode: "return" | "transfer";
  noteId: string;
  lines: FollowUpFormLine[];
  today: string;
  defaults: { receiverName: string; exchangeRate: string };
}) {
  const router = useRouter();
  const [isPaper, setIsPaper] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const form = useForm<Values>({
    defaultValues: {
      noteDate: today,
      receiverName: defaults.receiverName,
      exchangeRate: defaults.exchangeRate,
      observations: "",
      paperNumber: "",
      lines: lines.map((line) => ({
        originalLineId: line.id,
        quantity: "",
        unitPrice: line.suggestedPrice,
      })),
    },
  });
  const { errors } = form.formState;
  const watched = useWatch({ control: form.control, name: "lines" });
  const isTransfer = mode === "transfer";
  const credit = Money.sum(
    lines.map((line, index) => valueOf(watched?.[index]?.quantity, line.isFree ? "0" : line.unitPrice)),
  );
  const charge = Money.sum(
    lines.map((line, index) => valueOf(watched?.[index]?.quantity, watched?.[index]?.unitPrice)),
  );

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const paperNumber = isPaper ? values.paperNumber : "";
      const result = isTransfer
        ? await registerTransferAction(noteId, {
            noteDate: values.noteDate,
            exchangeRate: values.exchangeRate,
            observations: values.observations,
            paperNumber,
            lines: values.lines,
          } satisfies TransferInput)
        : await registerReturnAction(noteId, {
            noteDate: values.noteDate,
            receiverName: values.receiverName,
            observations: values.observations,
            paperNumber,
            lines: values.lines.map(({ originalLineId, quantity }) => ({ originalLineId, quantity })),
          } satisfies ReturnInput);
      if (!result.ok) {
        return applyActionError(form, result.error, { paperNumber: "Ya hay una boleta con ese número." });
      }
      toast.success(`${isTransfer ? "Traspaso" : "Devolución"} N.º ${result.data.number} registrado`);
      router.push(notePath(result.data.id));
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex max-w-4xl flex-col gap-8">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Entregado</TableHead>
            <TableHead className="text-right">Queda</TableHead>
            <TableHead className="text-right">Precio US$</TableHead>
            <TableHead className="w-32">{isTransfer ? "Pasa" : "Devuelve"}</TableHead>
            {isTransfer && <TableHead className="w-32">Precio nuevo US$</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, index) => {
            const blocked = Quantity.parse(line.remaining).isZero() || (isTransfer && line.isFree);
            const lineErrors = errors.lines?.[index];
            return (
              <TableRow key={line.id}>
                <TableCell className="whitespace-normal">{line.label}</TableCell>
                <TableCell className="text-right tabular-nums">{formatQuantity(line.delivered)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatQuantity(line.remaining)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {line.isFree ? "—" : formatMoney(line.unitPrice)}
                </TableCell>
                <TableCell>
                  <Input
                    inputMode="decimal"
                    selectOnFocus
                    aria-label={`Cantidad de ${line.label}`}
                    readOnly={blocked}
                    className={blocked ? "bg-muted/50" : undefined}
                    aria-invalid={!!lineErrors?.quantity}
                    {...form.register(`lines.${index}.quantity`)}
                  />
                  <FieldError errors={[lineErrors?.quantity]} />
                </TableCell>
                {isTransfer && (
                  <TableCell>
                    <Input
                      inputMode="decimal"
                      selectOnFocus
                      aria-label={`Precio nuevo de ${line.label}`}
                      readOnly={blocked}
                      className={blocked ? "bg-muted/50" : undefined}
                      aria-invalid={!!lineErrors?.unitPrice}
                      {...form.register(`lines.${index}.unitPrice`)}
                    />
                    <FieldError errors={[lineErrors?.unitPrice]} />
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <p className="text-sm">
        {isTransfer ? (
          <>
            Se descuenta <strong>US$ {formatMoney(credit.toDecimalString())}</strong> de la campaña de la
            boleta y se carga <strong>US$ {formatMoney(charge.toDecimalString())}</strong> en la campaña de la
            fecha.
          </>
        ) : (
          <>
            Se descuenta <strong>US$ {formatMoney(credit.toDecimalString())}</strong> de la deuda del cliente.
          </>
        )}
      </p>

      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field data-invalid={!!errors.noteDate}>
            <FieldLabel htmlFor="noteDate">Fecha</FieldLabel>
            <Controller
              control={form.control}
              name="noteDate"
              render={({ field }) => <DateInput id="noteDate" invalid={!!errors.noteDate} {...field} />}
            />
            <FieldError errors={[errors.noteDate]} />
          </Field>
          {isTransfer ? (
            <Field data-invalid={!!errors.exchangeRate}>
              <FieldLabel htmlFor="exchangeRate">Tipo de cambio (Bs por US$)</FieldLabel>
              <Input
                id="exchangeRate"
                inputMode="decimal"
                selectOnFocus
                aria-invalid={!!errors.exchangeRate}
                {...form.register("exchangeRate")}
              />
              <FieldError errors={[errors.exchangeRate]} />
            </Field>
          ) : (
            <Field data-invalid={!!errors.receiverName} className="sm:col-span-2">
              <FieldLabel htmlFor="receiverName">Quién devuelve</FieldLabel>
              <Input
                id="receiverName"
                aria-invalid={!!errors.receiverName}
                {...form.register("receiverName")}
              />
              <FieldError errors={[errors.receiverName]} />
            </Field>
          )}
        </div>
        <Field data-invalid={!!errors.observations}>
          <FieldLabel htmlFor="observations">Observaciones (opcional)</FieldLabel>
          <Textarea id="observations" {...form.register("observations")} />
          <FieldError errors={[errors.observations]} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPaper}
            onChange={(event) => setIsPaper(event.target.checked)}
            className="size-4"
          />
          Es una boleta de papel con número impreso
        </label>
        {isPaper && (
          <Field data-invalid={!!errors.paperNumber} className="max-w-40">
            <FieldLabel htmlFor="paperNumber">Número impreso</FieldLabel>
            <Input id="paperNumber" inputMode="numeric" selectOnFocus {...form.register("paperNumber")} />
            <FieldError errors={[errors.paperNumber]} />
          </Field>
        )}
      </FieldGroup>

      <FieldError errors={[errors.root]} />
      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          {isTransfer ? "Registrar traspaso" : "Registrar devolución"}
        </Button>
        <Link href={notePath(noteId)} className={buttonVariants({ variant: "ghost" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
});

/** Quantity × price while typing; zero until both are readable. */
function valueOf(quantity: string | undefined, price: string | undefined): Money {
  try {
    return Quantity.parse((quantity || "0").replace(",", ".")).times(
      Money.parse((price || "0").replace(",", ".")),
    );
  } catch {
    return Money.zero();
  }
}
