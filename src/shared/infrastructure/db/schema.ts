// Single entry point for drizzle-kit and the query builder: every module re-exports its tables here.
export * from "@/modules/campaigns/infrastructure/campaigns.table";
export * from "@/modules/catalog/infrastructure/catalog.tables";
export * from "@/modules/customers/infrastructure/customers.tables";
export * from "@/modules/identity/infrastructure/auth.tables";
export * from "@/modules/identity/infrastructure/permissions.table";
export * from "@/modules/migration/infrastructure/import.tables";
export * from "@/modules/receivables/infrastructure/ledger.tables";
export * from "@/modules/sales/infrastructure/notes.tables";
export * from "@/shared/infrastructure/db/document-counters";
export * from "@/shared/infrastructure/audit/audit-log.table";
