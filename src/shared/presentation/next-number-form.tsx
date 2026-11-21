"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { ActionResult } from "./action-result";
import { applyActionError } from "./form-errors";
import { resetOnLeave } from "./reset-on-leave";
import { Button } from "./ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";

const NOUNS = {
  boleta: { next: "La próxima boleta será la", paper: "Las boletas de papel" },
  recibo: { next: "El próximo recibo será el", paper: "Los recibos de papel" },
} as const;

type NextNumberValues = { nextNumber: string };

/**
 * Where the system's numbering continues for one kind of document (D19, D28). The system's numbers
 * go in a range the paper pads won't reach; paper documents keep their printed number.
 */
export const NextNumberForm = resetOnLeave(function NextNumberForm({
  nextNumber,
  noun,
  save,
}: {
  nextNumber: number;
  noun: keyof typeof NOUNS;
  save: (input: NextNumberValues) => Promise<ActionResult<null>>;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const form = useForm<NextNumberValues>({ defaultValues: { nextNumber: String(nextNumber) } });
  const { errors } = form.formState;
  const words = NOUNS[noun];

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await save(values);
      if (!result.ok) return applyActionError(form, result.error);
      setIsEditing(false);
      router.refresh();
    }),
  );

  if (!isEditing) {
    return (
      <p className="text-sm text-muted-foreground">
        {words.next} <span className="font-medium text-foreground">N.º {nextNumber}</span>.{" "}
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={() => {
            form.reset({ nextNumber: String(nextNumber) });
            setIsEditing(true);
          }}
        >
          Cambiar
        </button>
      </p>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1">
      <Field data-invalid={!!errors.nextNumber}>
        <FieldLabel htmlFor={`next-${noun}-number`}>Continuar la numeración desde</FieldLabel>
        <div className="flex gap-2">
          <Input
            id={`next-${noun}-number`}
            inputMode="numeric"
            selectOnFocus
            className="max-w-32"
            aria-invalid={!!errors.nextNumber}
            {...form.register("nextNumber")}
          />
          <Button type="submit" variant="outline" disabled={isSaving}>
            Guardar
          </Button>
          <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
            Cancelar
          </Button>
        </div>
        <FieldDescription>
          Usa un número que los talonarios no alcancen, por ejemplo 100001. {words.paper} se registran con su
          número impreso.
        </FieldDescription>
        <FieldError errors={[errors.nextNumber ?? errors.root]} />
      </Field>
    </form>
  );
});
