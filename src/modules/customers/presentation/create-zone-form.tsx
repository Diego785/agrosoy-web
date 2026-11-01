"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { applyActionError } from "@/shared/presentation/form-errors";
import { Button } from "@/shared/presentation/ui/button";
import { Field, FieldError, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { zoneSchema } from "../application/customer-schemas";
import { createZoneAction } from "./customer-actions";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

export const CreateZoneForm = resetOnLeave(function CreateZoneForm() {
  const [isSaving, startSaving] = useTransition();
  const form = useForm({ resolver: zodResolver(zoneSchema), defaultValues: { name: "" } });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await createZoneAction(values);
      if (!result.ok) {
        applyActionError(form, result.error, { name: "Esa zona ya existe." });
        return;
      }
      toast.success("Zona agregada");
      form.reset({ name: "" });
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="zone-name">Nueva zona</FieldLabel>
        <div className="flex gap-2">
          <Input id="zone-name" aria-invalid={!!errors.name} {...form.register("name")} />
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Agregando…" : "Agregar"}
          </Button>
        </div>
        <FieldError errors={[errors.name]} />
        <FieldError errors={[errors.root]} />
      </Field>
    </form>
  );
});
