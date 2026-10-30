import { notFound } from "next/navigation";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";
import { getUser } from "../application/user-use-cases";
import { drizzleUserDirectory } from "../infrastructure/drizzle-user-directory";
import { requireActor } from "./current-user";
import { EditUserForm } from "./edit-user-form";

export async function EditUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  const user = await getUser({ users: drizzleUserDirectory(getDb()) }, actor, { userId: id }).catch(
    (error: unknown) => {
      if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED"))
        notFound();
      throw error;
    },
  );

  return (
    <>
      <p className="-mt-4 text-sm text-muted-foreground">
        <span className="font-mono">{user.username}</span> · {ROLE_LABELS[user.role]}
      </p>
      <EditUserForm user={user} />
    </>
  );
}
