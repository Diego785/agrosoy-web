import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { normalizeForComparison } from "@/shared/domain/text";
import { customerRecord, type CustomerRecord, type ExchangeRateAgreement } from "../domain/customer";
import { zoneRecord } from "../domain/zone";
import type {
  CustomerFormData,
  CustomerListItem,
  CustomerRepository,
  TechnicianLookup,
  Zone,
  ZoneListItem,
  ZoneRepository,
} from "./ports";
import {
  customerIdSchema,
  customerSchema,
  customerSearchSchema,
  zoneIdSchema,
  zoneSchema,
} from "./customer-schemas";

export type CustomerDeps = {
  customers: CustomerRepository;
  zones: ZoneRepository;
  technicians: TechnicianLookup;
  audit: AuditTrail;
};

export const CUSTOMERS_PAGE_SIZE = 50;

export async function registerCustomer(
  deps: CustomerDeps,
  actor: Actor,
  input: unknown,
): Promise<{ id: string; code: number }> {
  assertCan(actor, "customers.manage");
  const record = await validCustomer(deps, input);

  const created = await deps.customers.insert(record);
  await deps.audit.record({
    actorId: actor.id,
    action: "customers.register",
    entityType: "customer",
    entityId: created.id,
    payload: auditPayload(record),
  });
  return created;
}

export async function updateCustomer(
  deps: CustomerDeps,
  actor: Actor,
  customerId: unknown,
  input: unknown,
): Promise<void> {
  assertCan(actor, "customers.manage");
  const id = validateInput(customerIdSchema, customerId);
  const current = await deps.customers.findForEdit(id);
  if (!current) throw new DomainError("NOT_FOUND", { entity: "customer", id });
  // A customer keeps a zone that was deactivated later; only new assignments must be active.
  const record = await validCustomer(deps, input, current.zoneId);

  await deps.customers.update(id, record);
  await deps.audit.record({
    actorId: actor.id,
    action: "customers.update",
    entityType: "customer",
    entityId: id,
    payload: auditPayload(record),
  });
}

export async function getCustomerForEdit(
  deps: Pick<CustomerDeps, "customers">,
  actor: Actor,
  customerId: unknown,
): Promise<CustomerFormData> {
  assertCan(actor, "customers.manage");
  const id = validateInput(customerIdSchema, customerId);
  const customer = await deps.customers.findForEdit(id);
  if (!customer) throw new DomainError("NOT_FOUND", { entity: "customer", id });
  return customer;
}

export async function searchCustomers(
  deps: Pick<CustomerDeps, "customers">,
  actor: Actor,
  input: unknown,
): Promise<{ items: CustomerListItem[]; total: number; page: number; pageSize: number }> {
  assertCan(actor, "customers.view");
  const { text, zoneId, page } = validateInput(customerSearchSchema, input);

  const result = await deps.customers.search({
    text: normalizeForComparison(text),
    zoneId,
    preferTechnicianId: actor.role === "sales_technician" ? actor.id : undefined,
    limit: CUSTOMERS_PAGE_SIZE,
    offset: (page - 1) * CUSTOMERS_PAGE_SIZE,
  });
  return { ...result, page, pageSize: CUSTOMERS_PAGE_SIZE };
}

/** Options for the customer form's selects. */
/**
 * Active zones and technicians for the customer form. When editing, the customer's own zone is
 * offered even if it was deactivated, so saving other changes doesn't drop it.
 */
export async function customerFormOptions(
  deps: Pick<CustomerDeps, "zones" | "technicians">,
  actor: Actor,
  keepZoneId: string | null = null,
): Promise<{ zones: (Zone & { isActive: boolean })[]; technicians: { id: string; name: string }[] }> {
  assertCan(actor, "customers.manage");
  const [active, technicians] = await Promise.all([deps.zones.list(), deps.technicians.listActive()]);
  const zones = active.map((zone) => ({ ...zone, isActive: true }));
  if (keepZoneId && !zones.some((zone) => zone.id === keepZoneId)) {
    const kept = await deps.zones.find(keepZoneId);
    if (kept) zones.push(kept);
  }
  return { zones, technicians };
}

/** Every zone, deactivated ones included, for the zones page and the customer search filter. */
export async function listAllZones(deps: Pick<CustomerDeps, "zones">, actor: Actor): Promise<ZoneListItem[]> {
  assertCan(actor, "customers.view");
  return deps.zones.listAll();
}

/** Fixes a zone's name; customers point at the zone, so they all show the new name. */
export async function renameZone(
  deps: Pick<CustomerDeps, "zones" | "audit">,
  actor: Actor,
  zoneId: unknown,
  input: unknown,
): Promise<void> {
  assertCan(actor, "customers.manage");
  const id = validateInput(zoneIdSchema, zoneId);
  const record = zoneRecord(validateInput(zoneSchema, input).name);
  const zone = await deps.zones.find(id);
  if (!zone) throw new DomainError("NOT_FOUND", { entity: "zone", id });
  if (zone.name === record.name) return;

  await deps.zones.rename(id, record);
  await deps.audit.record({
    actorId: actor.id,
    action: "customers.rename_zone",
    entityType: "zone",
    entityId: id,
    payload: { name: record.name, previousName: zone.name },
  });
}

/**
 * Zones are deactivated, never deleted: they stop being offered for customers, while the ones
 * that have it keep it (and, from week 2, the reference prices of that zone stay).
 */
export async function setZoneActive(
  deps: Pick<CustomerDeps, "zones" | "audit">,
  actor: Actor,
  zoneId: unknown,
  active: boolean,
): Promise<void> {
  assertCan(actor, "customers.manage");
  const id = validateInput(zoneIdSchema, zoneId);
  const zone = await deps.zones.find(id);
  if (!zone) throw new DomainError("NOT_FOUND", { entity: "zone", id });
  if (zone.isActive === active) return;

  await deps.zones.setActive(id, active);
  await deps.audit.record({
    actorId: actor.id,
    action: active ? "customers.reactivate_zone" : "customers.deactivate_zone",
    entityType: "zone",
    entityId: id,
    payload: { name: zone.name },
  });
}

export async function createZone(
  deps: Pick<CustomerDeps, "zones" | "audit">,
  actor: Actor,
  input: unknown,
): Promise<{ id: string }> {
  assertCan(actor, "customers.manage");
  const record = zoneRecord(validateInput(zoneSchema, input).name);

  const created = await deps.zones.insert(record);
  await deps.audit.record({
    actorId: actor.id,
    action: "customers.create_zone",
    entityType: "zone",
    entityId: created.id,
    payload: record,
  });
  return created;
}

async function validCustomer(
  deps: CustomerDeps,
  input: unknown,
  currentZoneId: string | null = null,
): Promise<CustomerRecord> {
  const data = validateInput(customerSchema, input);
  const record = customerRecord({ ...data, exchangeRateAgreement: agreementFrom(data) });

  // Ids come from the browser: check they point at a zone and an active technician.
  if (record.zoneId && record.zoneId !== currentZoneId && !(await deps.zones.exists(record.zoneId))) {
    throw invalidField("zoneId", "La zona elegida ya no existe.");
  }
  if (record.technicianId && !(await deps.technicians.isActiveTechnician(record.technicianId))) {
    throw invalidField("technicianId", "Elige un técnico de venta activo.");
  }
  return record;
}

function agreementFrom(data: {
  exchangeRateKind: "daily" | "fixed";
  fixedExchangeRate?: string;
}): ExchangeRateAgreement {
  return data.exchangeRateKind === "fixed"
    ? { kind: "fixed", rate: ExchangeRate.parse(data.fixedExchangeRate ?? "") }
    : { kind: "daily" };
}

function invalidField(field: string, message: string): DomainError {
  return new DomainError("VALIDATION_FAILED", { fieldErrors: { [field]: [message] } });
}

function auditPayload(record: CustomerRecord): Record<string, unknown> {
  const { exchangeRateAgreement, ...rest } = record;
  return {
    ...rest,
    exchangeRateAgreement:
      exchangeRateAgreement.kind === "fixed"
        ? { kind: "fixed", rate: exchangeRateAgreement.rate.toDecimalString() }
        : { kind: "daily" },
  };
}
