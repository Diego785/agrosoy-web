import type { Role } from "@/shared/domain/role";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administración",
  manager: "Gerencia",
  sales_technician: "Técnico de venta",
  warehouse_keeper: "Encargado de almacén",
};
