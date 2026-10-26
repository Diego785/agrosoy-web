"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ActionResult } from "@/shared/presentation/action-result";
import { errorMessage } from "@/shared/presentation/error-messages";
import { applyActionError } from "@/shared/presentation/form-errors";
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
import { FieldError } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { propertySchema, receiverSchema } from "../application/customer-schemas";
import {
  addPropertyAction,
  addReceiverAction,
  removePropertyAction,
  removeReceiverAction,
  setCustomerActiveAction,
} from "./customer-actions";

export function AddPropertyForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({ resolver: zodResolver(propertySchema), defaultValues: { name: "", location: "" } });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await addPropertyAction(customerId, values);
      if (!result.ok) return applyActionError(form, result.error);
      form.reset();
      router.refresh();
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-56"
          placeholder="Nombre de la propiedad"
          aria-label="Nombre de la propiedad"
          {...form.register("name")}
        />
        <Input
          className="max-w-64"
          placeholder="Ubicación (opcional)"
          aria-label="Ubicación"
          {...form.register("location")}
        />
        <Button type="submit" variant="outline" disabled={isSaving}>
          Agregar
        </Button>
      </div>
      <FieldError errors={[errors.name ?? errors.location ?? errors.root]} />
    </form>
  );
}

export function AddReceiverForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({
    resolver: zodResolver(receiverSchema),
    defaultValues: { name: "", documentId: "", relationship: "" },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await addReceiverAction(customerId, values);
      if (!result.ok) return applyActionError(form, result.error);
      form.reset();
      router.refresh();
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-56"
          placeholder="Nombre completo"
          aria-label="Nombre de quien recibe"
          {...form.register("name")}
        />
        <Input className="max-w-32" placeholder="CI" aria-label="CI" {...form.register("documentId")} />
        <Input
          className="max-w-48"
          placeholder="Cargo o parentesco"
          aria-label="Cargo o parentesco"
          {...form.register("relationship")}
        />
        <Button type="submit" variant="outline" disabled={isSaving}>
          Agregar
        </Button>
      </div>
      <FieldError errors={[errors.name ?? errors.documentId ?? errors.relationship ?? errors.root]} />
    </form>
  );
}

export function RemovePropertyButton({
  customerId,
  propertyId,
  name,
}: {
  customerId: string;
  propertyId: string;
  name: string;
}) {
  return (
    <ConfirmButton
      label="Quitar"
      title={`¿Quitar la propiedad «${name}»?`}
      description="Deja de aparecer para nuevas boletas; las anteriores la conservan."
      confirm="Quitar"
      run={() => removePropertyAction(customerId, propertyId)}
    />
  );
}

export function RemoveReceiverButton({
  customerId,
  receiverId,
  name,
}: {
  customerId: string;
  receiverId: string;
  name: string;
}) {
  return (
    <ConfirmButton
      label="Quitar"
      title={`¿Quitar a ${name}?`}
      description="Ya no podrá elegirse como quien recibe en nuevas boletas."
      confirm="Quitar"
      run={() => removeReceiverAction(customerId, receiverId)}
    />
  );
}

export function CustomerStatusButton({
  customerId,
  name,
  active,
}: {
  customerId: string;
  name: string;
  active: boolean;
}) {
  return (
    <ConfirmButton
      label={active ? "Desactivar" : "Reactivar"}
      variant={active ? "destructive" : "outline"}
      title={active ? `¿Desactivar a ${name}?` : `¿Reactivar a ${name}?`}
      description={
        active
          ? "No aparecerá en búsquedas ni podrá recibir nuevas boletas. Su historial y su deuda se conservan."
          : "Vuelve a aparecer en las búsquedas y puede recibir boletas."
      }
      confirm={active ? "Desactivar" : "Reactivar"}
      run={() => setCustomerActiveAction(customerId, !active)}
    />
  );
}

function ConfirmButton({
  label,
  title,
  description,
  confirm,
  run,
  variant = "ghost",
}: {
  label: string;
  title: string;
  description: string;
  confirm: string;
  run: () => Promise<ActionResult<unknown>>;
  variant?: "ghost" | "outline" | "destructive";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isWorking, startWorking] = useTransition();

  function proceed() {
    startWorking(async () => {
      const result = await run();
      setOpen(false);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant={variant} size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !isWorking && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={proceed}
              disabled={isWorking}
            >
              {confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
