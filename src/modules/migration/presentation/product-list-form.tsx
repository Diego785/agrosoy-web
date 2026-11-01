"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { LINE_LABELS, contentLabel, priceUnitLabel } from "@/modules/catalog/presentation/catalog-labels";
import { PRODUCTS_PATH } from "@/modules/catalog/presentation/catalog-routes";
import { errorMessage } from "@/shared/presentation/error-messages";
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

export function ProductListForm({
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
      const { newProducts, newPresentations, prices } = result.data;
      toast.success("Lista de productos importada", {
        description: `${newProducts} productos y ${newPresentations} presentaciones nuevas, ${prices} precios.`,
      });
      router.push(PRODUCTS_PATH);
    });
  }

  const campaign = campaigns.find((option) => option.id === campaignId);

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={review} className="flex max-w-2xl flex-col gap-4">
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
              onChange={(event) => setCampaignId(event.target.value)}
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
          Primero se muestra lo que se va a crear; nada se guarda hasta confirmar. Los precios pasan a ser los
          precios generales de la campaña, y cada zona puede tener los suyos. Importar la misma lista otra vez
          no repite nada: solo actualiza los precios.
        </FieldDescription>
        {error && <FieldError>{error}</FieldError>}
        <Button
          type="submit"
          variant={preview ? "outline" : "default"}
          disabled={isWorking || !file}
          className="self-start"
        >
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
                  <TableCell className="font-mono text-xs">{row.code}</TableCell>
                  <TableCell>
                    <span className="font-medium">{row.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      Fila {row.row}: {row.label}
                    </span>
                  </TableCell>
                  <TableCell>{contentLabel({ content: row.content, unit: row.unit })}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.price ? `${formatMoney(row.price)} por ${priceUnitLabel(row)}` : "—"}
                  </TableCell>
                  <TableCell>{LINE_LABELS[row.line]}</TableCell>
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
            {isWorking ? "Importando…" : `Importar con los precios de ${campaign?.label ?? "la campaña"}`}
          </Button>
        </section>
      )}
    </div>
  );
}

function Summary({ preview }: { preview: ProductListPreview }) {
  const { newProducts, newPresentations, existing, conflicts, prices } = preview.counts;
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
      <Figure label="Productos nuevos" value={newProducts} />
      <Figure label="Presentaciones nuevas" value={newPresentations} />
      <Figure label="Ya existen" value={existing} />
      <Figure label="Con conflicto (no se importan)" value={conflicts} />
      <Figure label="Precios" value={prices} />
    </dl>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function PlanBadge({ plan }: { plan: ProductListRowPlan }) {
  switch (plan.status) {
    case "new_product":
      return <Badge>Producto nuevo</Badge>;
    case "new_presentation":
      return <Badge variant="secondary">Presentación nueva</Badge>;
    case "existing":
      return (
        <>
          <Badge variant="outline">Ya existe</Badge>
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
      return `El código ya es de ${plan.productName} ${contentLabel(plan)}.`;
    case "other_code":
      return `El producto ya tiene ese envase con el código ${plan.code}.`;
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
    <section className="flex flex-col gap-1 text-sm">
      <h3 className="font-medium">No se importan</h3>
      <ul className="text-muted-foreground">
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
