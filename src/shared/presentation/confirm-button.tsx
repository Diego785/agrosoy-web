"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "./action-result";
import { errorMessage } from "./error-messages";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";

/** A button that asks before running an action, then refreshes the page with the result. */
export function ConfirmButton({
  label,
  title,
  description,
  confirm,
  run,
  variant = "ghost",
}: {
  label: string;
  title: string;
  description: string;
  confirm: string;
  run: () => Promise<ActionResult<unknown>>;
  variant?: "ghost" | "outline" | "destructive";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isWorking, startWorking] = useTransition();

  function proceed() {
    startWorking(async () => {
      const result = await run();
      setOpen(false);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant={variant} size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !isWorking && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={proceed}
              disabled={isWorking}
            >
              {confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
