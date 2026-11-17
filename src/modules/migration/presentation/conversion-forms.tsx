"use client";

import { CircleCheckIcon, PackagePlusIcon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LINE_LABELS, SALE_UNIT_LABELS, UNIT_LABELS } from "@/modules/catalog/presentation/catalog-labels";
import { errorMessage } from "@/shared/presentation/error-messages";
import { formatQuantity } from "@/shared/presentation/format";
import { Badge } from "@/shared/presentation/ui/badge";
import { Button } from "@/shared/presentation/ui/button";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import type { ConversionPreview, ProductGroup } from "../application/conversion";
import { convertCustomersAction, convertProductsAction } from "./conversion-actions";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

export const CustomerConversion = resetOnLeave(function CustomerConversion({
  preview,
}: {
  preview: ConversionPreview;
}) {
  const router = useRouter();
  const [technicianId, setTechnicianId] = useState(preview.suggestedTechnicianId ?? "");
  // A new name starts linked to the customer it most likely is (D47); "" registers it as new.
  const [links, setLinks] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      preview.customers
        .filter((customer) => !customer.existing && customer.suggestions[0])
        .map((customer) => [customer.key, customer.suggestions[0]!.id]),
    ),
  );
  const [isWorking, startWorking] = useTransition();
  const missing = preview.customers.filter((customer) => !customer.existing);
  const linked = missing.filter((customer) => links[customer.key]).length;
  const created = missing.length - linked;

  function convert() {
    startWorking(async () => {
      const result = await convertCustomersAction(
        preview.batch.id,
        technicianId,
        missing.flatMap((customer) =>
          links[customer.key] ? [{ key: customer.key, customerId: links[customer.key]! }] : [],
        ),
      );
      if (!result.ok) return void toast.error(errorMessage(result.error));
      const { created: registered, linked: joined } = result.data;
      toast.success(
        [registered > 0 && `${registered} clientes registrados`, joined > 0 && `${joined} nombres enlazados`]
          .filter(Boolean)
          .join(" y "),
      );
      router.refresh();
    });
  }

  const code = (number: number) => String(number).padStart(4, "0");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Clientes</h2>
      {missing.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Si un nombre nuevo es un cliente ya registrado escrito de otra forma, elígelo: el nombre queda
          enlazado y las próximas planillas lo encuentran solo.
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente en la planilla</TableHead>
            <TableHead>En el sistema</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.customers.map((customer) => (
            <TableRow key={customer.key}>
              <TableCell className="font-medium">{customer.name}</TableCell>
              <TableCell>
                {customer.existing ? (
                  <Badge variant="neutral">
                    Ya existe · <span className="font-mono">{code(customer.existing.code)}</span>
                    {customer.existing.name !== customer.name && ` ${customer.existing.name}`}
                  </Badge>
                ) : (
                  <NativeSelect
                    value={links[customer.key] ?? ""}
                    onChange={(event) =>
                      setLinks((previous) => ({ ...previous, [customer.key]: event.target.value }))
                    }
                    aria-label={`Qué es «${customer.name}» en el sistema`}
                    className="max-w-96"
                  >
                    <NativeSelectOption value="">Cliente nuevo</NativeSelectOption>
                    {customer.suggestions.length > 0 && (
                      <optgroup label="Parecidos">
                        {customer.suggestions.map((suggestion) => (
                          <NativeSelectOption key={suggestion.id} value={suggestion.id}>
                            Es {code(suggestion.code)} · {suggestion.name}
                          </NativeSelectOption>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Todos los clientes">
                      {preview.allCustomers.map((option) => (
                        <NativeSelectOption key={option.id} value={option.id}>
                          Es {code(option.code)} · {option.name}
                        </NativeSelectOption>
                      ))}
                    </optgroup>
                  </NativeSelect>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {missing.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {created > 0 && (
            <NativeSelect
              value={technicianId}
              onChange={(event) => setTechnicianId(event.target.value)}
              aria-label="Técnico de los clientes nuevos"
            >
              <NativeSelectOption value="">Sin técnico asignado</NativeSelectOption>
              {preview.technicians.map((technician) => (
                <NativeSelectOption key={technician.id} value={technician.id}>
                  {technician.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
          <Button onClick={convert} disabled={isWorking}>
            <UserPlusIcon aria-hidden />
            {isWorking
              ? "Guardando…"
              : [created > 0 && `Registrar ${created} nuevos`, linked > 0 && `enlazar ${linked}`]
                  .filter(Boolean)
                  .join(" y ")
                  .replace(/^e/, "E")}
          </Button>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheckIcon className="size-4 text-success" aria-hidden />
          Todos los clientes de la planilla ya están registrados.
        </p>
      )}
    </section>
  );
});

type Decision = { line: string; saleUnit: string };

export const ProductConversion = resetOnLeave(function ProductConversion({
  preview,
}: {
  preview: ConversionPreview;
}) {
  const router = useRouter();
  const pending = preview.products.filter((group) => group.presentations.some((p) => !p.exists));
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [isWorking, startWorking] = useTransition();
  const ready = pending.filter((group) => isDecided(group, decisions[group.key])).length;

  function decide(key: string, change: Partial<Decision>) {
    setDecisions((current) => ({
      ...current,
      [key]: { line: "", saleUnit: "", ...current[key], ...change },
    }));
  }

  function convert() {
    startWorking(async () => {
      const chosen = pending
        .filter((group) => isDecided(group, decisions[group.key]))
        .map((group) => ({
          key: group.key,
          line: group.existingId ? undefined : decisions[group.key]?.line,
          saleUnit: decisions[group.key]?.saleUnit ?? "",
        }));
      const result = await convertProductsAction(preview.batch.id, chosen);
      if (!result.ok) return void toast.error(errorMessage(result.error));
      toast.success(
        `${result.data.createdProducts} productos creados y ${result.data.addedPresentations} presentaciones agregadas`,
      );
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Productos</h2>
      <p className="text-sm text-muted-foreground">
        La planilla no dice la línea ni si el precio es por envase o por litro o kilo: elígelos para cada
        producto nuevo. Los que dejes sin elegir no se crean.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Presentaciones</TableHead>
            <TableHead>Línea</TableHead>
            <TableHead>Precio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.products.map((group) => {
            const needsDecision = group.presentations.some((p) => !p.exists);
            return (
              <TableRow key={group.key}>
                <TableCell>
                  <span className="font-medium">{group.name}</span>
                  {group.existingId && <span className="block text-xs text-muted-foreground">Ya existe</span>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {group.presentations.map((presentation) => (
                      <Badge
                        key={`${presentation.content}${presentation.unit}`}
                        variant={presentation.exists ? "neutral" : "info"}
                        title={presentation.labels.join(", ")}
                      >
                        {formatQuantity(presentation.content)} {UNIT_LABELS[presentation.unit]}
                        {!presentation.exists && " · nueva"}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {needsDecision && !group.existingId ? (
                    <NativeSelect
                      value={decisions[group.key]?.line ?? ""}
                      onChange={(event) => decide(group.key, { line: event.target.value })}
                      aria-label={`Línea de ${group.name}`}
                    >
                      <NativeSelectOption value="">Elegir…</NativeSelectOption>
                      {Object.entries(LINE_LABELS).map(([value, label]) => (
                        <NativeSelectOption key={value} value={value}>
                          {label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {needsDecision ? (
                    <NativeSelect
                      value={decisions[group.key]?.saleUnit ?? ""}
                      onChange={(event) => decide(group.key, { saleUnit: event.target.value })}
                      aria-label={`Cómo se cobra ${group.name}`}
                    >
                      <NativeSelectOption value="">Elegir…</NativeSelectOption>
                      {Object.entries(SALE_UNIT_LABELS).map(([value, label]) => (
                        <NativeSelectOption key={value} value={value}>
                          {label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  ) : (
                    <span className="text-sm text-muted-foreground">Ya registrado</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {preview.unreadableProducts.length > 0 && (
        <p className="text-sm text-muted-foreground">
          No se pudo leer la presentación de: {preview.unreadableProducts.join(", ")}. Créalos a mano en
          Productos.
        </p>
      )}
      {pending.length > 0 ? (
        <Button onClick={convert} disabled={isWorking || ready === 0} className="self-start">
          <PackagePlusIcon aria-hidden />
          {isWorking ? "Creando…" : `Crear ${ready} de ${pending.length} productos`}
        </Button>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheckIcon className="size-4 text-success" aria-hidden />
          Todos los productos y presentaciones ya están registrados.
        </p>
      )}
    </section>
  );
});

function isDecided(group: ProductGroup, decision: Decision | undefined): boolean {
  return !!decision?.saleUnit && (!!group.existingId || !!decision.line);
}
