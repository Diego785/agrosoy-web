"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { ConfirmButton } from "@/shared/presentation/confirm-button";
import { applyActionError } from "@/shared/presentation/form-errors";
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
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

export const AddPropertyForm = resetOnLeave(function AddPropertyForm({ customerId }: { customerId: string }) {
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
});

export const AddReceiverForm = resetOnLeave(function AddReceiverForm({ customerId }: { customerId: string }) {
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
});

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
