"use client";

import { EllipsisVerticalIcon, KeyRoundIcon, UserCheckIcon, UserXIcon } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/presentation/ui/dropdown-menu";
import { resetUserPasswordAction, setUserActiveAction } from "./user-actions";
import { TemporaryPasswordNotice } from "./temporary-password-notice";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

type Props = { userId: string; name: string; username: string; active: boolean };

type Dialog = "reset" | "toggle" | { password: string } | null;

export const UserRowActions = resetOnLeave(function UserRowActions({
  userId,
  name,
  username,
  active,
}: Props) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [isWorking, startWorking] = useTransition();

  function resetPassword() {
    startWorking(async () => {
      const result = await resetUserPasswordAction(userId);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        setDialog(null);
        return;
      }
      setDialog({ password: result.data.temporaryPassword });
    });
  }

  function toggleActive() {
    startWorking(async () => {
      const result = await setUserActiveAction(userId, !active);
      setDialog(null);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(active ? `${name} ya no puede ingresar` : `${name} puede volver a ingresar`);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label={`Acciones para ${name}`} />}
        >
          <EllipsisVerticalIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {active && (
            <DropdownMenuItem onClick={() => setDialog("reset")}>
              <KeyRoundIcon aria-hidden />
              Restablecer contraseña
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant={active ? "destructive" : "default"} onClick={() => setDialog("toggle")}>
            {active ? <UserXIcon aria-hidden /> : <UserCheckIcon aria-hidden />}
            {active ? "Desactivar" : "Reactivar"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={dialog !== null} onOpenChange={(open) => !open && !isWorking && setDialog(null)}>
        <AlertDialogContent>
          {dialog === "reset" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Restablecer la contraseña de {name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se cerrarán sus sesiones abiertas y recibirá una contraseña temporal nueva.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isWorking}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={resetPassword} disabled={isWorking}>
                  {isWorking ? "Restableciendo…" : "Restablecer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {dialog === "toggle" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {active ? `¿Desactivar a ${name}?` : `¿Reactivar a ${name}?`}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {active
                    ? "No podrá ingresar y se cerrarán sus sesiones. Sus registros se conservan."
                    : "Podrá volver a ingresar con su contraseña actual."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isWorking}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant={active ? "destructive" : "default"}
                  onClick={toggleActive}
                  disabled={isWorking}
                >
                  {active ? "Desactivar" : "Reactivar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {dialog !== null && typeof dialog === "object" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Contraseña temporal de {name}</AlertDialogTitle>
              </AlertDialogHeader>
              <TemporaryPasswordNotice username={username} password={dialog.password} />
              <AlertDialogFooter>
                <AlertDialogCancel>Listo</AlertDialogCancel>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
