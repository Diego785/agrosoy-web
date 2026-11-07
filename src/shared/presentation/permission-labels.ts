import type { Permission } from "@/shared/application/permissions";

export const PERMISSION_LABELS: Record<Permission, { label: string; description: string }> = {
  "users.manage": {
    label: "Usuarios y permisos",
    description: "Crear usuarios, restablecer contraseñas y ajustar permisos.",
  },
  "audit.view": { label: "Registro de cambios", description: "Ver quién hizo cada cambio y cuándo." },
  "customers.view": { label: "Ver clientes", description: "Buscar clientes y ver sus datos." },
  "customers.manage": { label: "Editar clientes", description: "Registrar y editar clientes y zonas." },
  "statements.view": { label: "Estados de cuenta", description: "Ver la deuda de cualquier cliente." },
  "catalog.view": { label: "Ver catálogo", description: "Ver productos, precios y campañas." },
  "catalog.manage": {
    label: "Editar catálogo",
    description: "Productos, presentaciones, precios de referencia y campañas.",
  },
  "notes.view": { label: "Ver boletas", description: "Buscar boletas y ver su detalle." },
  "notes.manage": {
    label: "Registrar boletas",
    description: "Crear, editar y confirmar boletas.",
  },
  "notes.void": {
    label: "Anular boletas",
    description: "Anular boletas confirmadas y fijar desde qué número sigue la numeración.",
  },
  "payments.manage": {
    label: "Cobranzas",
    description: "Registrar y anular pagos y cargos, y el tipo de cambio del día.",
  },
  "imports.manage": {
    label: "Importar planillas",
    description: "Subir planillas de Excel y revisar sus observaciones.",
  },
};
