"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/shared/presentation/error-messages";
import { Button } from "@/shared/presentation/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { importWorkbookAction } from "./import-actions";

export function ImportForm() {
  const [error, setError] = useState<string>();
  const [isImporting, startImporting] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startImporting(async () => {
      setError(undefined);
      const result = await importWorkbookAction(data);
      if (!result.ok) {
        setError(result.error.fieldErrors?.file?.[0] ?? errorMessage(result.error));
        return;
      }
      const { sheets, skippedSheets } = result.data;
      if (sheets.length === 0) {
        setError("El archivo no tiene ninguna hoja con la tabla de ventas (FECHA, PRODUCTO, CLIENTE).");
        return;
      }
      toast.success(
        sheets.length === 1
          ? `Hoja «${sheets[0]?.sheetName}» importada`
          : `${sheets.length} hojas importadas`,
        skippedSheets.length > 0
          ? { description: `Sin tabla de ventas: ${skippedSheets.join(", ")}` }
          : undefined,
      );
      form.reset();
    });
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-3">
      <Field>
        <FieldLabel htmlFor="file">Planilla de ventas (.xlsx)</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <Input
            id="file"
            name="file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="max-w-sm"
          />
          <Button type="submit" disabled={isImporting}>
            {isImporting ? "Importando…" : "Importar"}
          </Button>
        </div>
        <FieldDescription>
          Se lee cada hoja con la tabla de ventas y su resumen de deudas. Si una hoja ya se importó, se
          reemplaza con la nueva versión.
        </FieldDescription>
      </Field>
      {error && <FieldError>{error}</FieldError>}
    </form>
  );
}
