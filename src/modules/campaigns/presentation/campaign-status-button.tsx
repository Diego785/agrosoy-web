"use client";

import { LockIcon, LockOpenIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/shared/presentation/error-messages";
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
import { Button } from "@/shared/presentation/ui/button";
import type { Campaign } from "../application/campaign-ports";
import { setCampaignStatusAction } from "./campaign-actions";
import { campaignLabel } from "./campaign-labels";
import { CAMPAIGNS_PATH } from "./campaign-routes";

/** Closes an open campaign after asking, or reopens a closed one (D37). */
export function CampaignStatusButton({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isWorking, startWorking] = useTransition();
  const label = campaignLabel(campaign);

  function change(status: Campaign["status"]) {
    startWorking(async () => {
      const result = await setCampaignStatusAction(campaign.id, status);
      setOpen(false);
      if (!result.ok) return void toast.error(errorMessage(result.error));
      toast.success(status === "closed" ? `Campaña ${label} cerrada` : `Campaña ${label} reabierta`);
      router.push(CAMPAIGNS_PATH);
    });
  }

  if (campaign.status === "closed") {
    return (
      <Button type="button" variant="outline" disabled={isWorking} onClick={() => change("open")}>
        <LockOpenIcon aria-hidden />
        Reabrir campaña
      </Button>
    );
  }
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <LockIcon aria-hidden />
        Cerrar campaña
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !isWorking && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar la campaña {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya no se podrá elegir en una boleta, ni registrar boletas, devoluciones, traspasos o cobros con
              fecha dentro de ella, ni agregarle cargos. La deuda que quede se sigue cobrando y sus intereses
              siguen corriendo. Se puede reabrir cuando haga falta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => change("closed")} disabled={isWorking}>
              Cerrar campaña
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
