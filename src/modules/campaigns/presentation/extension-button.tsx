"use client";

import { CalendarClockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { DateInput } from "@/shared/presentation/date-input";
import { errorMessage } from "@/shared/presentation/error-messages";
import { applyActionError } from "@/shared/presentation/form-errors";
import { formatDate } from "@/shared/presentation/format";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";
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
import { Button } from "@/shared/presentation/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/shared/presentation/ui/field";
import { Textarea } from "@/shared/presentation/ui/textarea";
import { removeDueDateExtensionAction, setDueDateExtensionAction } from "./campaign-actions";

type ExtensionValues = { dueOn: string; reason: string };

/** Gives a customer more time to pay one campaign, changes it or takes it back (D37). */
export const ExtensionButton = resetOnLeave(function ExtensionButton({
  customerId,
  campaignId,
  campaignLabel,
  campaignDueOn,
  current,
}: {
  customerId: string;
  campaignId: string;
  campaignLabel: string;
  campaignDueOn: string;
  current: { dueOn: string; reason: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isWorking, startWorking] = useTransition();
  const form = useForm<ExtensionValues>({
    defaultValues: { dueOn: current?.dueOn ?? "", reason: current?.reason ?? "" },
  });
  const { errors } = form.formState;

  const save = form.handleSubmit((values) =>
    startWorking(async () => {
      const result = await setDueDateExtensionAction({ customerId, campaignId, ...values });
      if (!result.ok) return applyActionError(form, result.error);
      setOpen(false);
      toast.success(`Vence el ${formatDate(values.dueOn)} para este cliente`);
      router.refresh();
    }),
  );

  const remove = () =>
    startWorking(async () => {
      const result = await removeDueDateExtensionAction({ customerId, campaignId });
      if (!result.ok) return void toast.error(errorMessage(result.error));
      setOpen(false);
      toast.success(`Vuelve a vencer el ${formatDate(campaignDueOn)}`);
      router.refresh();
    });

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          form.reset({ dueOn: current?.dueOn ?? "", reason: current?.reason ?? "" });
          setOpen(true);
        }}
      >
        <CalendarClockIcon aria-hidden />
        {current ? "Cambiar plazo" : "Dar más plazo"}
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !isWorking && setOpen(next)}>
        <AlertDialogContent>
          <form onSubmit={save} noValidate className="flex flex-col gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>Más plazo en {campaignLabel}</AlertDialogTitle>
              <AlertDialogDescription>
                La campaña vence el {formatDate(campaignDueOn)}. Con más plazo, la deuda de este cliente en
                esa campaña recién figura como vencida después de la nueva fecha.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Field data-invalid={!!errors.dueOn}>
              <FieldLabel htmlFor="extensionDueOn">Nuevo vencimiento</FieldLabel>
              <Controller
                control={form.control}
                name="dueOn"
                render={({ field }) => <DateInput id="extensionDueOn" invalid={!!errors.dueOn} {...field} />}
              />
              <FieldError errors={[errors.dueOn]} />
            </Field>
            <Field data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="extensionReason">Motivo</FieldLabel>
              <Textarea
                id="extensionReason"
                placeholder="Por ejemplo: cosecha tarde en la zona norte"
                aria-invalid={!!errors.reason}
                {...form.register("reason")}
              />
              <FieldDescription>Queda en el registro de cambios.</FieldDescription>
              <FieldError errors={[errors.reason ?? errors.root]} />
            </Field>
            <AlertDialogFooter>
              {current && (
                <Button
                  type="button"
                  variant="ghost"
                  className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isWorking}
                  onClick={remove}
                >
                  Quitar el plazo extra
                </Button>
              )}
              <AlertDialogCancel disabled={isWorking}>Cancelar</AlertDialogCancel>
              <AlertDialogAction type="submit" disabled={isWorking}>
                Guardar
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
