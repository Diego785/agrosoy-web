"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MapPinIcon, PencilIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "cn";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { Badge } from "@/shared/presentation/ui/badge";
import { Button } from "@/shared/presentation/ui/button";
import { FieldError } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { zoneSchema } from "../application/customer-schemas";
import type { ZoneListItem } from "../application/ports";
import { renameZoneAction, setZoneActiveAction } from "./customer-actions";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

/** One zone with its rename and deactivate controls, for administration and management. */
export const ZoneRow = resetOnLeave(function ZoneRow({ zone }: { zone: ZoneListItem }) {
  const [isEditing, setIsEditing] = useState(false);
  return isEditing ? (
    <RenameZoneForm zone={zone} onDone={() => setIsEditing(false)} />
  ) : (
    <div className="flex items-center justify-between gap-3">
      <ZoneName zone={zone} />
      <div className="flex shrink-0 gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
          <PencilIcon aria-hidden />
          Renombrar
        </Button>
        <ZoneStatusButton zone={zone} />
      </div>
    </div>
  );
});

export function ZoneName({ zone }: { zone: ZoneListItem }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          zone.isActive ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <MapPinIcon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn("font-medium", !zone.isActive && "text-muted-foreground")}>{zone.name}</span>
          {!zone.isActive && <Badge variant="destructive">Desactivada</Badge>}
        </span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {zone.customerCount === 1 ? "1 cliente" : `${zone.customerCount} clientes`}
        </span>
      </span>
    </span>
  );
}

function RenameZoneForm({ zone, onDone }: { zone: ZoneListItem; onDone: () => void }) {
  const [isSaving, startSaving] = useTransition();
  const form = useForm({ resolver: zodResolver(zoneSchema), defaultValues: { name: zone.name } });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await renameZoneAction(zone.id, values);
      if (!result.ok)
        return applyActionError(form, result.error, { name: "Ya hay otra zona con ese nombre." });
      toast.success("Zona renombrada");
      onDone();
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Input
          aria-label="Nuevo nombre de la zona"
          autoFocus
          aria-invalid={!!errors.name}
          {...form.register("name")}
        />
        <Button type="submit" size="sm" disabled={isSaving}>
          Guardar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
      <FieldError errors={[errors.name ?? errors.root]} />
    </form>
  );
}

function ZoneStatusButton({ zone }: { zone: ZoneListItem }) {
  const [open, setOpen] = useState(false);
  const [isWorking, startWorking] = useTransition();

  function change(active: boolean) {
    startWorking(async () => {
      const result = await setZoneActiveAction(zone.id, active);
      setOpen(false);
      if (!result.ok) return void toast.error(errorMessage(result.error));
      toast.success(active ? "Zona reactivada" : "Zona desactivada");
    });
  }

  if (!zone.isActive) {
    return (
      <Button type="button" variant="ghost" size="sm" disabled={isWorking} onClick={() => change(true)}>
        Reactivar
      </Button>
    );
  }
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Desactivar
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !isWorking && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar la zona «{zone.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de ofrecerse para nuevos clientes.
              {zone.customerCount > 0 &&
                ` ${zone.customerCount === 1 ? "El cliente que la tiene la conserva" : `Los ${zone.customerCount} clientes que la tienen la conservan`}.`}{" "}
              Se puede reactivar en cualquier momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => change(false)} disabled={isWorking}>
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
