"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/shared/presentation/error-messages";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";
import { Button } from "@/shared/presentation/ui/button";
import { Input } from "@/shared/presentation/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import type { ContentUnit, ProductLine, SaleUnit } from "../domain/product";
import { savePricesAction } from "./catalog-actions";
import { LINE_LABELS, contentLabel, priceUnitLabel } from "./catalog-labels";

export type PriceRow = {
  presentationId: string;
  code: string;
  productName: string;
  line: ProductLine;
  content: string;
  unit: ContentUnit;
  saleUnit: SaleUnit;
  /** "9.50", or "" without a price. */
  price: string;
  /** The general price shown as a hint while editing a zone. */
  generalPrice: string | null;
};

export const PriceSheetForm = resetOnLeave(function PriceSheetForm({
  campaignId,
  zoneId,
  rows,
}: {
  campaignId: string;
  zoneId: string;
  rows: PriceRow[];
}) {
  const [prices, setPrices] = useState(() => new Map(rows.map((row) => [row.presentationId, row.price])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();

  function save() {
    startSaving(async () => {
      const entries = rows.map((row) => ({
        presentationId: row.presentationId,
        price: prices.get(row.presentationId) ?? "",
      }));
      const result = await savePricesAction({ campaignId, zoneId, prices: entries });
      if (result.ok) {
        setErrors({});
        toast.success("Precios guardados");
        return;
      }
      // Field errors come as "prices.<index>.price".
      const byRow: Record<string, string> = {};
      for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        const index = Number(field.split(".")[1]);
        const row = rows[index];
        if (row && messages[0]) byRow[row.presentationId] = messages[0];
      }
      setErrors(byRow);
      toast.error(errorMessage(result.error));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Código</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Presentación</TableHead>
            <TableHead>Línea</TableHead>
            <TableHead className="w-48">Precio US$</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.presentationId}>
              <TableCell className="font-mono text-xs text-muted-foreground">{row.code}</TableCell>
              <TableCell className="font-medium">{row.productName}</TableCell>
              <TableCell>{contentLabel(row)}</TableCell>
              <TableCell className="text-muted-foreground">{LINE_LABELS[row.line]}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Input
                    inputMode="decimal"
                    selectOnFocus
                    className="w-24 text-right"
                    value={prices.get(row.presentationId) ?? ""}
                    placeholder={row.generalPrice ?? ""}
                    aria-label={`Precio de ${row.productName} ${contentLabel(row)}`}
                    aria-invalid={!!errors[row.presentationId]}
                    onChange={(event) =>
                      setPrices((current) => new Map(current).set(row.presentationId, event.target.value))
                    }
                  />
                  <span className="text-xs text-muted-foreground">por {priceUnitLabel(row)}</span>
                </div>
                {errors[row.presentationId] && (
                  <span className="text-xs text-destructive">{errors[row.presentationId]}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button onClick={save} disabled={isSaving} className="self-start">
        {isSaving ? "Guardando…" : "Guardar precios"}
      </Button>
    </div>
  );
});
