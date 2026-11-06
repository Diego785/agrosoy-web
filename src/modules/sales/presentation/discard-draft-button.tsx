"use client";

import { Trash2Icon } from "lucide-react";
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
import { discardDraftNoteAction } from "./note-actions";
import { NOTES_PATH } from "./note-routes";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

/** Drafts can be thrown away; confirmed notes will only be voided (D6). */
export const DiscardDraftButton = resetOnLeave(function DiscardDraftButton({ noteId }: { noteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isWorking, startWorking] = useTransition();

  function discard() {
    startWorking(async () => {
      const result = await discardDraftNoteAction(noteId);
      setOpen(false);
      if (!result.ok) return void toast.error(errorMessage(result.error));
      toast.success("Borrador descartado");
      router.push(NOTES_PATH);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon aria-hidden />
        Descartar
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !isWorking && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar este borrador?</AlertDialogTitle>
            <AlertDialogDescription>
              No se confirmó, así que no afecta deudas ni stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={discard} disabled={isWorking}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
