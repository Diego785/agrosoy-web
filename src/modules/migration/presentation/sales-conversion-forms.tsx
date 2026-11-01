"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { errorMessage } from "@/shared/presentation/error-messages";
import { applyActionError } from "@/shared/presentation/form-errors";
import { formatDate, formatDateTime } from "@/shared/presentation/format";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/presentation/ui/alert-dialog";
import { Button, buttonVariants } from "@/shared/presentation/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import { Textarea } from "@/shared/presentation/ui/textarea";
import { convertSalesAction, undoSalesConversionAction } from "./conversion-actions";
import { reconciliationPath } from "./migration-routes";
import { DateInput } from "@/shared/presentation/date-input";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

type SalesValues = { campaignId: string; cutoffDate: string; defaultExchangeRate: string };

/** Step 3 of the conversion: the sheet's sales and payments into the ledger, or what was done. */
export const SalesConversion = resetOnLeave(function SalesConversion({
  batchId,
  campaigns,
  suggestedCampaignId,
  defaultCutoffDate,
  conversion,
}: {
  batchId: string;
  campaigns: { id: string; label: string }[];
  suggestedCampaignId: string | null;
  defaultCutoffDate: string;
  conversion: { campaignLabel: string; cutoffDate: string; at: Date } | null;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Ventas y pagos</h2>
      {conversion ? (
        <>
          <p className="text-sm">
            Pasadas al sistema el {formatDateTime(conversion.at)}, en la campaña {conversion.campaignLabel}.
            Los pagos del resumen quedaron con fecha {formatDate(conversion.cutoffDate)}.
          </p>
          <div className="flex gap-2">
            <Link href={reconciliationPath(batchId)} className={buttonVariants()}>
              Ver conciliación
            </Link>
            <UndoSalesButton batchId={batchId} />
          </div>
        </>
      ) : (
        <SalesForm
          batchId={batchId}
          campaigns={campaigns}
          suggestedCampaignId={suggestedCampaignId}
          defaultCutoffDate={defaultCutoffDate}
        />
      )}
    </section>
  );
});

function SalesForm({
  batchId,
  campaigns,
  suggestedCampaignId,
  defaultCutoffDate,
}: {
  batchId: string;
  campaigns: { id: string; label: string }[];
  suggestedCampaignId: string | null;
  defaultCutoffDate: string;
}) {
  const router = useRouter();
  const [isWorking, startWorking] = useTransition();
  const form = useForm<SalesValues>({
    defaultValues: {
      campaignId: suggestedCampaignId ?? "",
      cutoffDate: defaultCutoffDate,
      defaultExchangeRate: "12.00",
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startWorking(async () => {
      const result = await convertSalesAction({ batchId, ...values });
      if (!result.ok) return applyActionError(form, result.error);
      const { notes, entries, skipped } = result.data;
      toast.success(
        `${notes} boletas y ${entries} pagos o devoluciones pasados${skipped.length ? `; ${skipped.length} filas quedaron fuera` : ""}`,
      );
      router.push(reconciliationPath(batchId));
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Cada venta pasa como boleta confirmada marcada «de planilla», con su número; los pagos y devoluciones
        del resumen pasan con la fecha de corte. Antes, pasa los clientes y productos. No mueve stock: el
        stock inicial sale del conteo físico.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field data-invalid={!!errors.campaignId}>
          <FieldLabel htmlFor="campaignId">Campaña de la planilla</FieldLabel>
          <NativeSelect id="campaignId" aria-invalid={!!errors.campaignId} {...form.register("campaignId")}>
            <NativeSelectOption value="">Elegir campaña…</NativeSelectOption>
            {campaigns.map((campaign) => (
              <NativeSelectOption key={campaign.id} value={campaign.id}>
                {campaign.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError errors={[errors.campaignId]} />
        </Field>
        <Field data-invalid={!!errors.cutoffDate}>
          <FieldLabel htmlFor="cutoffDate">Fecha de corte</FieldLabel>
          <Controller
            control={form.control}
            name="cutoffDate"
            render={({ field }) => <DateInput id="cutoffDate" invalid={!!errors.cutoffDate} {...field} />}
          />
          <FieldDescription>La planilla no fecha los pagos del resumen.</FieldDescription>
          <FieldError errors={[errors.cutoffDate]} />
        </Field>
        <Field data-invalid={!!errors.defaultExchangeRate}>
          <FieldLabel htmlFor="defaultExchangeRate">Tipo de cambio si falta</FieldLabel>
          <Input
            id="defaultExchangeRate"
            inputMode="decimal"
            selectOnFocus
            aria-invalid={!!errors.defaultExchangeRate}
            {...form.register("defaultExchangeRate")}
          />
          <FieldError errors={[errors.defaultExchangeRate]} />
        </Field>
      </div>
      <FieldError errors={[errors.root]} />
      <div>
        <Button type="submit" disabled={isWorking}>
          {isWorking ? "Pasando…" : "Pasar ventas y pagos al sistema"}
        </Button>
      </div>
    </form>
  );
}

function UndoSalesButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isWorking, startWorking] = useTransition();

  function undo() {
    startWorking(async () => {
      const result = await undoSalesConversionAction({ batchId, reason });
      if (!result.ok)
        return void toast.error(result.error.fieldErrors?.reason?.[0] ?? errorMessage(result.error));
      setOpen(false);
      toast.success(`Conversión deshecha: ${result.data.voidedNotes} boletas anuladas`);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Deshacer
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !isWorking && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deshacer el paso de ventas y pagos?</AlertDialogTitle>
            <AlertDialogDescription>
              Las boletas de planilla quedan anuladas y sus montos y pagos se revierten con fecha de hoy.
              Después puedes corregir la planilla, importarla de nuevo y volver a pasarla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="undoReason">Motivo</FieldLabel>
            <Textarea id="undoReason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={undo} disabled={isWorking}>
              Deshacer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
