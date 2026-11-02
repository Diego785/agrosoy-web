import { Fragment } from "react";
import { ROLES } from "@/shared/domain/role";
import { getDb } from "@/shared/infrastructure/db/client";
import { Loading, Skeleton } from "@/shared/presentation/skeletons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import { getPermissionMatrix } from "../application/permission-use-cases";
import { drizzlePermissionSettings } from "../infrastructure/drizzle-permission-settings";
import { requireActor } from "./current-user";
import { PermissionMatrixForm } from "./permission-matrix-form";

export async function PermissionMatrix() {
  const actor = await requireActor();
  const matrix = await getPermissionMatrix({ permissions: drizzlePermissionSettings(getDb()) }, actor);
  return <PermissionMatrixForm matrix={matrix} />;
}

/** How many permissions each area of the matrix lists, in its order. */
const AREA_SIZES = [2, 3, 1, 2, 2];

/**
 * The matrix while it loads, laid out like `PermissionMatrixForm`. Unlike other lists it is the
 * same table on phones (it scrolls sideways), so it doesn't use `TableSkeleton`.
 */
export function PermissionMatrixSkeleton() {
  return (
    <Loading label="Cargando permisos">
      <div aria-hidden>
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead>
                <Skeleton className="h-3 w-16" />
              </TableHead>
              {ROLES.map((role) => (
                <TableHead key={role} className="w-32">
                  <Skeleton className="mx-auto h-3 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {AREA_SIZES.map((size, area) => (
              <Fragment key={area}>
                <TableRow className="bg-muted/35 hover:bg-muted/35">
                  <TableCell colSpan={ROLES.length + 1} className="py-2">
                    <Skeleton className="h-3 w-28" />
                  </TableCell>
                </TableRow>
                {Array.from({ length: size }, (_, row) => (
                  <TableRow key={row}>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-40" />
                        <Skeleton className="h-3 w-64" />
                      </div>
                    </TableCell>
                    {ROLES.map((role) => (
                      <TableCell key={role}>
                        <Skeleton className="mx-auto size-4.5 rounded-sm" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <div aria-hidden className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full max-w-xl flex-col gap-1.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-1/3" />
        </div>
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
    </Loading>
  );
}
