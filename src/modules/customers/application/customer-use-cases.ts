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
  ZoneRepository,
} from "./ports";
import { customerIdSchema, customerSchema, customerSearchSchema, zoneSchema } from "./customer-schemas";

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
  const record = await validCustomer(deps, input);

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
export async function customerFormOptions(
  deps: Pick<CustomerDeps, "zones" | "technicians">,
  actor: Actor,
): Promise<{ zones: Zone[]; technicians: { id: string; name: string }[] }> {
  assertCan(actor, "customers.manage");
  const [zones, technicians] = await Promise.all([deps.zones.list(), deps.technicians.listActive()]);
  return { zones, technicians };
}

export async function listZones(deps: Pick<CustomerDeps, "zones">, actor: Actor): Promise<Zone[]> {
  assertCan(actor, "customers.view");
  return deps.zones.list();
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

async function validCustomer(deps: CustomerDeps, input: unknown): Promise<CustomerRecord> {
  const data = validateInput(customerSchema, input);
  const record = customerRecord({ ...data, exchangeRateAgreement: agreementFrom(data) });

  // Ids come from the browser: check they point at a zone and an active technician.
  if (record.zoneId && !(await deps.zones.exists(record.zoneId))) {
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
