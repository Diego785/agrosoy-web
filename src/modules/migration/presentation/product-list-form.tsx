"use client";

import { FileSearchIcon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { LINE_LABELS, contentLabel, priceUnitLabel } from "@/modules/catalog/presentation/catalog-labels";
import { PRODUCTS_PATH } from "@/modules/catalog/presentation/catalog-routes";
import { errorMessage } from "@/shared/presentation/error-messages";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";
import { formatMoney } from "@/shared/presentation/format";
import { Badge } from "@/shared/presentation/ui/badge";
import { Button } from "@/shared/presentation/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import type { ProductListPreview, ProductListRowPlan } from "../application/product-list-import";
import type { ProductListFinding, SkippedProductListRow } from "../domain/product-list";
import { importProductListAction, previewProductListAction } from "./product-list-actions";

type Row = ProductListPreview["rows"][number];

export const ProductListForm = resetOnLeave(function ProductListForm({
  campaigns,
  defaultCampaignId,
}: {
  campaigns: { id: string; label: string }[];
  defaultCampaignId: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File>();
  const [campaignId, setCampaignId] = useState(defaultCampaignId);
  const [preview, setPreview] = useState<ProductListPreview>();
  const [error, setError] = useState<string>();
  const [isWorking, startWorking] = useTransition();

  function formData() {
    const data = new FormData();
    if (file) data.set("file", file);
    data.set("campaignId", campaignId);
    return data;
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startWorking(async () => {
      setError(undefined);
      const result = await previewProductListAction(formData());
      if (!result.ok) {
        setPreview(undefined);
        setError(
          result.error.code === "INVALID_FILE"
            ? "No se encontró la lista de productos (columnas CODIGOS, PRODUCTOS y PRECIO) en ese archivo."
            : errorMessage(result.error),
        );
        return;
      }
      setPreview(result.data);
    });
  }

  function save() {
    startWorking(async () => {
      const result = await importProductListAction(formData());
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      const { newProducts, newPresentations, priceChanges, renamed } = result.data;
      toast.success("Lista de productos importada", {
        description: [
          `${newProducts} productos y ${newPresentations} presentaciones nuevas`,
          `${priceChanges} precios cambiados`,
          `${renamed} nombres cambiados`,
        ].join(", "),
      });
      router.push(PRODUCTS_PATH);
    });
  }

  const campaign = campaigns.find((option) => option.id === campaignId);

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={review}
        className="flex max-w-2xl flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs"
      >
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field>
            <FieldLabel htmlFor="file">Lista de productos (.xlsx)</FieldLabel>
            <Input
              id="file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              onChange={(event) => {
                setFile(event.target.files?.[0]);
                setPreview(undefined);
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="campaignId">Campaña de los precios</FieldLabel>
            <NativeSelect
              id="campaignId"
              value={campaignId}
              onChange={(event) => {
                // The preview compares prices with this campaign's: it has to be read again.
                setCampaignId(event.target.value);
                setPreview(undefined);
              }}
            >
              {campaigns.map((option) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <FieldDescription>
          Primero se muestra lo que va a cambiar; nada se guarda hasta confirmar. Los precios pasan a ser los
          precios generales de la campaña, y cada zona puede tener los suyos. El código identifica cada
          presentación: para cambiar el precio o el nombre de un producto, cámbialo en la lista y deja su
          código. Importar la lista otra vez no repite nada: solo aplica lo que cambió.
        </FieldDescription>
        {error && <FieldError>{error}</FieldError>}
        <Button
          type="submit"
          variant={preview ? "outline" : "default"}
          disabled={isWorking || !file}
          className="self-start"
        >
          <FileSearchIcon aria-hidden />
          {isWorking && !preview ? "Leyendo…" : "Revisar lista"}
        </Button>
      </form>

      {preview && (
        <section className="flex flex-col gap-4">
          <Summary preview={preview} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Código</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Presentación</TableHead>
                <TableHead className="text-right">Precio US$</TableHead>
                <TableHead>Línea</TableHead>
                <TableHead>Qué pasa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((row) => (
                <TableRow
                  key={row.row}
                  className={row.plan.status === "conflict" ? "text-muted-foreground" : ""}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.code}</TableCell>
                  <TableCell>
                    <span className="font-medium">{row.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      Fila {row.row}: {row.label}
                    </span>
                  </TableCell>
                  <TableCell>{contentLabel({ content: row.content, unit: row.unit })}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.price ? `${formatMoney(row.price)} por ${priceUnitLabel(row)}` : "—"}
                    {row.plan.status === "existing" && row.plan.priceChange && (
                      <span className="block text-xs text-muted-foreground">
                        {row.plan.priceChange.from
                          ? `antes ${formatMoney(row.plan.priceChange.from)}`
                          : "antes sin precio"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{LINE_LABELS[row.line]}</TableCell>
                  <TableCell className="whitespace-normal">
                    <PlanBadge plan={row.plan} />
                    {row.findings.map((finding) => (
                      <span key={finding} className="block text-xs text-muted-foreground">
                        {findingText(finding, row)}
                      </span>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {preview.skipped.length > 0 && <Skipped rows={preview.skipped} />}
          <Button onClick={save} disabled={isWorking} className="self-start">
            <UploadIcon aria-hidden />
            {isWorking ? "Importando…" : `Importar con los precios de ${campaign?.label ?? "la campaña"}`}
          </Button>
        </section>
      )}
    </div>
  );
});

function Summary({ preview }: { preview: ProductListPreview }) {
  const { newProducts, newPresentations, existing, conflicts, priceChanges, renamed } = preview.counts;
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
      <Figure label="Productos nuevos" value={newProducts} />
      <Figure label="Presentaciones nuevas" value={newPresentations} />
      <Figure label="Ya existen" value={existing} />
      <Figure label="Cambian de precio" value={priceChanges} />
      <Figure label="Cambian de nombre" value={renamed} />
      <Figure label="Con conflicto (no se importan)" value={conflicts} alert={conflicts > 0} />
    </dl>
  );
}

function Figure({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div
      className={`flex flex-col justify-between rounded-xl border p-4 shadow-xs ${alert ? "border-destructive/30 bg-destructive/5" : "bg-card"}`}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 text-xl font-semibold tracking-tight tabular-nums ${alert ? "text-destructive" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function PlanBadge({ plan }: { plan: ProductListRowPlan }) {
  switch (plan.status) {
    case "new_product":
      return <Badge variant="info">Producto nuevo</Badge>;
    case "new_presentation":
      return <Badge variant="info">Presentación nueva</Badge>;
    case "existing":
      return (
        <>
          <Badge variant={plan.priceChange || plan.renamedFrom ? "warning" : "neutral"}>
            {plan.priceChange || plan.renamedFrom ? "Se actualiza" : "Sin cambios"}
          </Badge>
          {plan.priceChange && <span className="block text-xs">Cambia el precio.</span>}
          {plan.renamedFrom && <span className="block text-xs">Antes se llamaba {plan.renamedFrom}.</span>}
          {plan.nameKept && (
            <span className="block text-xs text-muted-foreground">
              {plan.nameKept === "name_taken"
                ? `Ya hay otro producto con este nombre: sigue como ${plan.productName}.`
                : `Las otras presentaciones de ${plan.productName} tienen otro nombre en la lista: el nombre no cambia.`}
            </span>
          )}
          {plan.priceKept && (
            <span className="block text-xs text-muted-foreground">
              En el sistema se cobra de otra forma: su precio no cambia.
            </span>
          )}
        </>
      );
    case "conflict":
      return (
        <>
          <Badge variant="destructive">No se importa</Badge>
          <span className="block text-xs">{conflictText(plan)}</span>
        </>
      );
  }
}

function conflictText(plan: Extract<ProductListRowPlan, { status: "conflict" }>): string {
  switch (plan.reason) {
    case "code_taken":
      return `El código ya es de ${plan.productName} ${contentLabel(plan)}, otro envase. Para un envase nuevo usa un código nuevo.`;
    case "other_code":
      return `${plan.productName} ya tiene ese envase con el código ${plan.code}. Para cambiar su precio o su nombre, usa el código ${plan.code}.`;
    case "repeated":
      return "El mismo producto y envase ya está más arriba en la lista.";
  }
}

function findingText(finding: ProductListFinding, row: Row): string {
  switch (finding) {
    case "NO_CONTAINER":
      return "Sin envase en el nombre: se crea como 1 unidad cobrada por envase. Revisa la presentación.";
    case "NO_PRICE_UNIT":
      return "No dice por qué es el precio: se cobra por envase.";
    case "UNKNOWN_PRICE_UNIT":
      return `«${row.priceUnit}» no se reconoce: se cobra por envase.`;
    case "PRICE_UNIT_MISMATCH":
      return `Dice «${row.priceUnit}» pero el envase es de ${contentLabel(row)}: se cobra por ${priceUnitLabel(row)}.`;
    case "NO_PRICE":
      return "Sin precio: se puede poner luego en Precios.";
  }
}

const SKIP_REASONS: Record<SkippedProductListRow["reason"], string> = {
  CHARGE_CONCEPT: "concepto de cobro (intereses, ajustes, contratos): irá en los cargos, no es un producto",
  INVALID_CODE: "el código no es un número",
  REPEATED_CODE: "el código ya está más arriba en la lista",
};

function Skipped({ rows }: { rows: SkippedProductListRow[] }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-dashed bg-card/60 p-5 text-sm">
      <h3 className="font-semibold">No se importan</h3>
      <ul className="flex flex-col gap-1 text-muted-foreground">
        {rows.map((row) => (
          <li key={row.row}>
            Fila {row.row}: {row.code ? `${row.code} ` : ""}
            {row.label}, {SKIP_REASONS[row.reason]}.
          </li>
        ))}
      </ul>
    </section>
  );
}
