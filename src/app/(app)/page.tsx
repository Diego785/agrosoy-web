import { Suspense } from "react";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-16 w-64 animate-pulse rounded-md bg-muted" />}>
      <Greeting />
    </Suspense>
  );
}

async function Greeting() {
  const actor = await requireActor();
  const firstName = actor.name.split(" ")[0];
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">Hola, {firstName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{ROLE_LABELS[actor.role]}</p>
    </header>
  );
}
