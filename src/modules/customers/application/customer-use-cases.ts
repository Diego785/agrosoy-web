import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { normalizeForComparison } from "@/shared/domain/text";
import { customerRecord, type CustomerRecord, type ExchangeRateAgreement } from "../domain/customer";
import { propertyRecord, receiverRecord } from "../domain/customer-contacts";
import { zoneRecord } from "../domain/zone";
import type {
  CustomerDetail,
  CustomerFormData,
  CustomerListItem,
  CustomerOption,
  CustomerRepository,
  TechnicianLookup,
  Zone,
  ZoneRepository,
} from "./ports";
import {
  customerIdSchema,
  customerSchema,
  customerSearchSchema,
  propertySchema,
  receiverSchema,
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
  if (record.technicianId) await deps.customers.assignTechnician(created.id, record.technicianId);
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
  const before = await deps.customers.findForEdit(id);

  await deps.customers.update(id, record);
  // The portfolio history only changes when the technician does.
  if ((before?.technicianId ?? null) !== (record.technicianId ?? null)) {
    await deps.customers.assignTechnician(id, record.technicianId ?? null);
  }
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
  const { text, zoneId, status, page } = validateInput(customerSearchSchema, input);

  const result = await deps.customers.search({
    text: normalizeForComparison(text),
    zoneId,
    status,
    preferTechnicianId: actor.role === "sales_technician" ? actor.id : undefined,
    limit: CUSTOMERS_PAGE_SIZE,
    offset: (page - 1) * CUSTOMERS_PAGE_SIZE,
  });
  return { ...result, page, pageSize: CUSTOMERS_PAGE_SIZE };
}

/** Active sales technicians, to filter portfolios. */
export async function technicianOptions(
  deps: Pick<CustomerDeps, "technicians">,
  actor: Actor,
): Promise<{ id: string; name: string }[]> {
  assertCan(actor, "customers.view");
  return deps.technicians.listActive();
}

/** Active customers for the pickers of other modules' forms (payments, charges, statements). */
export async function customerOptions(
  deps: Pick<CustomerDeps, "customers">,
  actor: Actor,
): Promise<CustomerOption[]> {
  assertCan(actor, "customers.view");
  return deps.customers.activeOptions();
}

/** Everything known about a customer, for the customer page. Every role can look customers up. */
export async function getCustomerDetail(
  deps: Pick<CustomerDeps, "customers">,
  actor: Actor,
  customerId: unknown,
): Promise<CustomerDetail> {
  assertCan(actor, "customers.view");
  const id = validateInput(customerIdSchema, customerId);
  const customer = await deps.customers.findDetail(id);
  if (!customer) throw new DomainError("NOT_FOUND", { entity: "customer", id });
  return customer;
}

/** Deactivated customers leave searches and new notes but keep their history. */
export async function setCustomerActive(
  deps: Pick<CustomerDeps, "customers" | "audit">,
  actor: Actor,
  customerId: unknown,
  active: boolean,
): Promise<void> {
  assertCan(actor, "customers.manage");
  const id = validateInput(customerIdSchema, customerId);
  await deps.customers.setActive(id, active);
  await deps.audit.record({
    actorId: actor.id,
    action: active ? "customers.reactivate" : "customers.deactivate",
    entityType: "customer",
    entityId: id,
    payload: {},
  });
}

export async function addCustomerProperty(
  deps: Pick<CustomerDeps, "customers" | "audit">,
  actor: Actor,
  customerId: unknown,
  input: unknown,
): Promise<{ id: string }> {
  assertCan(actor, "customers.manage");
  const id = validateInput(customerIdSchema, customerId);
  const property = propertyRecord(validateInput(propertySchema, input));
  const created = await deps.customers.addProperty(id, property);
  await deps.audit.record({
    actorId: actor.id,
    action: "customers.add_property",
    entityType: "customer",
    entityId: id,
    payload: { ...property, propertyId: created.id },
  });
  return created;
}

export async function removeCustomerProperty(
  deps: Pick<CustomerDeps, "customers" | "audit">,
  actor: Actor,
  customerId: unknown,
  propertyId: unknown,
): Promise<void> {
  assertCan(actor, "customers.manage");
  const id = validateInput(customerIdSchema, customerId);
  const property = validateInput(customerIdSchema, propertyId);
  await deps.customers.deactivateProperty(id, property);
  await deps.audit.record({
    actorId: actor.id,
    action: "customers.remove_property",
    entityType: "customer",
    entityId: id,
    payload: { propertyId: property },
  });
}

export async function addAuthorizedReceiver(
  deps: Pick<CustomerDeps, "customers" | "audit">,
  actor: Actor,
  customerId: unknown,
  input: unknown,
): Promise<{ id: string }> {
  assertCan(actor, "customers.manage");
  const id = validateInput(customerIdSchema, customerId);
  const receiver = receiverRecord(validateInput(receiverSchema, input));
  const created = await deps.customers.addReceiver(id, receiver);
  await deps.audit.record({
    actorId: actor.id,
    action: "customers.add_receiver",
    entityType: "customer",
    entityId: id,
    payload: { ...receiver, receiverId: created.id },
  });
  return created;
}

export async function removeAuthorizedReceiver(
  deps: Pick<CustomerDeps, "customers" | "audit">,
  actor: Actor,
  customerId: unknown,
  receiverId: unknown,
): Promise<void> {
  assertCan(actor, "customers.manage");
  const id = validateInput(customerIdSchema, customerId);
  const receiver = validateInput(customerIdSchema, receiverId);
  await deps.customers.deactivateReceiver(id, receiver);
  await deps.audit.record({
    actorId: actor.id,
    action: "customers.remove_receiver",
    entityType: "customer",
    entityId: id,
    payload: { receiverId: receiver },
  });
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
