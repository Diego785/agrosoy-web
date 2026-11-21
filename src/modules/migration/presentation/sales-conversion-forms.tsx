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
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import { Textarea } from "@/shared/presentation/ui/textarea";
import type { SalesReadiness } from "../application/sales-conversion";
import { convertSalesAction, undoSalesConversionAction } from "./conversion-actions";
import { reconciliationPath } from "./migration-routes";
import { DateInput } from "@/shared/presentation/date-input";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

type SalesValues = { campaignId: string; cutoffDate: string; technicianId: string };

/** Step 3 of the conversion: the sheet's sales and payments into the ledger, or what was done. */
export const SalesConversion = resetOnLeave(function SalesConversion({
  batchId,
  campaigns,
  suggestedCampaignId,
  technicians,
  suggestedTechnicianId,
  defaultCutoffDate,
  conversion,
  readiness,
}: {
  batchId: string;
  campaigns: { id: string; label: string }[];
  suggestedCampaignId: string | null;
  technicians: { id: string; name: string }[];
  /** The technician named in the sheet's name ("Ing. Favio Añez"). */
  suggestedTechnicianId: string | null;
  defaultCutoffDate: string;
  conversion: { campaignLabel: string; cutoffDate: string; at: Date } | null;
  /** Customers and products of the sheet still missing; the sales wait for them (D43). */
  readiness: SalesReadiness;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Ventas y pagos</h2>
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
          technicians={technicians}
          suggestedTechnicianId={suggestedTechnicianId}
          defaultCutoffDate={defaultCutoffDate}
          readiness={readiness}
        />
      )}
    </section>
  );
});

function SalesForm({
  batchId,
  campaigns,
  suggestedCampaignId,
  technicians,
  suggestedTechnicianId,
  defaultCutoffDate,
  readiness,
}: {
  batchId: string;
  campaigns: { id: string; label: string }[];
  suggestedCampaignId: string | null;
  technicians: { id: string; name: string }[];
  suggestedTechnicianId: string | null;
  defaultCutoffDate: string;
  readiness: SalesReadiness;
}) {
  const isReady = readiness.missingCustomers.length === 0 && readiness.missingProducts.length === 0;
  const router = useRouter();
  const [isWorking, startWorking] = useTransition();
  const form = useForm<SalesValues>({
    defaultValues: {
      campaignId: suggestedCampaignId ?? "",
      cutoffDate: defaultCutoffDate,
      technicianId: suggestedTechnicianId ?? "",
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startWorking(async () => {
      const result = await convertSalesAction({ batchId, ...values });
      if (!result.ok) return applyActionError(form, result.error);
      const { notes, entries } = result.data;
      toast.success(`${notes} boletas y ${entries} pagos o devoluciones pasados`);
      router.push(reconciliationPath(batchId));
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Cada venta pasa como boleta confirmada marcada «de planilla», con su número y el técnico de la
        planilla; los pagos y devoluciones del resumen pasan con la fecha de corte. Las ventas sin tipo de
        cambio quedan sin él, hasta que se cobren. No mueve stock: el stock inicial sale del conteo físico.
      </p>
      {!isReady && (
        <div className="flex flex-col gap-1 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
          <p className="font-medium">Antes, pasa lo que falta en los pasos de arriba:</p>
          {readiness.missingCustomers.length > 0 && (
            <p>
              <span className="text-muted-foreground">Clientes:</span> {readiness.missingCustomers.join(", ")}
            </p>
          )}
          {readiness.missingProducts.length > 0 && (
            <p>
              <span className="text-muted-foreground">Productos:</span> {readiness.missingProducts.join(", ")}
            </p>
          )}
          <p className="text-muted-foreground">
            Así ninguna fila queda fuera y la conciliación coincide con la planilla.
          </p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field data-invalid={!!errors.technicianId}>
          <FieldLabel htmlFor="technicianId">Técnico de la planilla</FieldLabel>
          <NativeSelect
            id="technicianId"
            aria-invalid={!!errors.technicianId}
            {...form.register("technicianId")}
          >
            <NativeSelectOption value="">El técnico de cada cliente</NativeSelectOption>
            {technicians.map((technician) => (
              <NativeSelectOption key={technician.id} value={technician.id}>
                {technician.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>Sus boletas quedan a su nombre, aunque hoy atienda otro.</FieldDescription>
          <FieldError errors={[errors.technicianId]} />
        </Field>
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
          <FieldDescription>
            El día hasta el que está al día la planilla. Los pagos y devoluciones del resumen no tienen fecha
            y quedan con esta.
          </FieldDescription>
          <FieldError errors={[errors.cutoffDate]} />
        </Field>
      </div>
      <FieldError errors={[errors.root]} />
      <div>
        <Button type="submit" disabled={isWorking || !isReady}>
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
