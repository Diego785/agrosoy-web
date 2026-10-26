/** The four roles agreed in the discovery meeting (docs/glossary.md). */
export const ROLES = ["admin", "manager", "sales_technician", "warehouse_keeper"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
