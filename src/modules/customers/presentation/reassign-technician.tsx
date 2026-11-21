"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { normalizeForComparison } from "@/shared/domain/text";
import { errorMessage } from "@/shared/presentation/error-messages";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";
import { Button } from "@/shared/presentation/ui/button";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import type { PortfolioCustomer, Technician } from "../application/ports";
import { formatCustomerCode } from "../domain/customer";
import { assignTechnicianToCustomersAction } from "./customer-actions";

const customers = (count: number) => (count === 1 ? "1 cliente" : `${count} clientes`);

/**
 * Hands several customers to another technician at once, as the lists change from one campaign to
 * the next (D46). Each customer keeps the history of who looked after them; their notes keep their
 * own technician.
 */
export const ReassignTechnician = resetOnLeave(function ReassignTechnician({
  portfolio,
  technicians,
}: {
  portfolio: PortfolioCustomer[];
  technicians: Technician[];
}) {
  const router = useRouter();
  const [from, setFrom] = useState("all");
  const [text, setText] = useState("");
  const [target, setTarget] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [isSaving, startSaving] = useTransition();

  const shown = useMemo(() => {
    const wanted = normalizeForComparison(text);
    return portfolio.filter(
      (customer) =>
        (from === "all" || (customer.technicianId ?? "none") === from) &&
        (!wanted ||
          normalizeForComparison(`${customer.name} ${customer.locality ?? ""}`).includes(wanted) ||
          formatCustomerCode(customer.code).includes(wanted)),
    );
  }, [portfolio, from, text]);
  const chosen = portfolio.filter((customer) => selected.has(customer.id));
  const allShownChosen = shown.length > 0 && shown.every((customer) => selected.has(customer.id));
  const targetName = target
    ? (technicians.find((technician) => technician.id === target)?.name ?? "")
    : "nadie";

  const toggle = (id: string, checked: boolean) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  const toggleShown = (checked: boolean) =>
    setSelected((previous) => {
      const next = new Set(previous);
      for (const customer of shown) {
        if (checked) next.add(customer.id);
        else next.delete(customer.id);
      }
      return next;
    });

  function save() {
    startSaving(async () => {
      const result = await assignTechnicianToCustomersAction({
        customerIds: chosen.map((customer) => customer.id),
        technicianId: target,
      });
      if (!result.ok) return void toast.error(errorMessage(result.error));
      toast.success(
        result.data.changed === 0
          ? "Esos clientes ya tenían ese técnico"
          : `${customers(result.data.changed)} pasaron a ${target ? targetName : "no tener técnico"}`,
      );
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          aria-label="Técnico actual"
        >
          <NativeSelectOption value="all">Todos los técnicos</NativeSelectOption>
          <NativeSelectOption value="none">Sin técnico</NativeSelectOption>
          {technicians.map((technician) => (
            <NativeSelectOption key={technician.id} value={technician.id}>
              Clientes de {technician.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Nombre, código o localidad"
          aria-label="Buscar cliente"
          className="max-w-64"
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <label className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2.5 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={allShownChosen}
            disabled={shown.length === 0}
            onChange={(event) => toggleShown(event.target.checked)}
          />
          Elegir los {customers(shown.length)} de la lista
        </label>
        {shown.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Ningún cliente coincide.</p>
        ) : (
          <ul className="max-h-[28rem] divide-y overflow-y-auto">
            {shown.map((customer) => (
              <li key={customer.id}>
                <label className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/30">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={selected.has(customer.id)}
                    onChange={(event) => toggle(customer.id, event.target.checked)}
                  />
                  <span className="w-12 font-mono text-xs text-muted-foreground">
                    {formatCustomerCode(customer.code)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{customer.name}</span>
                    {customer.locality && (
                      <span className="block text-xs text-muted-foreground">{customer.locality}</span>
                    )}
                  </span>
                  <span className="text-right text-muted-foreground">
                    {customer.technicianName ?? "Sin técnico"}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          aria-label="Nuevo técnico"
        >
          <NativeSelectOption value="">Sin técnico</NativeSelectOption>
          {technicians.map((technician) => (
            <NativeSelectOption key={technician.id} value={technician.id}>
              {technician.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="button" disabled={chosen.length === 0 || isSaving} onClick={save}>
          {isSaving
            ? "Guardando…"
            : chosen.length === 0
              ? "Elige los clientes"
              : `Pasar ${customers(chosen.length)} a ${targetName}`}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Cada cliente guarda quién lo atendía antes. Sus boletas quedan con el técnico que las hizo, y su deuda
        sigue en la cartera de ese técnico.
      </p>
    </div>
  );
});
