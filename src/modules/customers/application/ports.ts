import type { CustomerRecord } from "../domain/customer";
import type { PropertyRecord, ReceiverRecord } from "../domain/customer-contacts";
import type { ZoneRecord } from "../domain/zone";

export type CustomerListItem = {
  id: string;
  code: number;
  name: string;
  taxId: string | null;
  identityCard: string | null;
  phone: string | null;
  zoneName: string | null;
  locality: string | null;
  technicianName: string | null;
};

/** An active customer in a picker, with what a document for them needs. */
export type CustomerOption = {
  id: string;
  code: number;
  name: string;
  fixedExchangeRate: string | null;
  /** Suggested on a new note (D48). */
  usualPaymentTerms: "cash" | "credit" | null;
};

export type CustomerFormData = {
  id: string;
  code: number;
  name: string;
  taxId: string | null;
  identityCard: string | null;
  phone: string | null;
  zoneId: string | null;
  locality: string | null;
  technicianId: string | null;
  usualPaymentTerms: "cash" | "credit" | null;
  exchangeRateKind: "daily" | "fixed";
  /** "6.9600" or null. */
  fixedExchangeRate: string | null;
  notes: string | null;
};

export type CustomerDetail = CustomerFormData & {
  zoneName: string | null;
  technicianName: string | null;
  isActive: boolean;
  properties: { id: string; name: string; location: string | null }[];
  receivers: { id: string; name: string; documentId: string | null; relationship: string }[];
  /** Portfolio history, newest first; the open one has no end. */
  assignments: { technicianName: string; startsAt: Date; endsAt: Date | null }[];
  /** Other ways the sheets write the name (D47). */
  aliases: { id: string; name: string }[];
};

/** An active customer with who looks after them, for handing several to another technician. */
export type PortfolioCustomer = {
  id: string;
  code: number;
  name: string;
  locality: string | null;
  technicianId: string | null;
  technicianName: string | null;
};

export type CustomerQuery = {
  /** Already normalized with normalizeForComparison; empty lists everyone. */
  text: string;
  zoneId?: string;
  /** Customers of this technician come first (each technician sees their portfolio first). */
  preferTechnicianId?: string;
  /** Inactive customers are hidden unless asked for. */
  status: "active" | "inactive";
  limit: number;
  offset: number;
};

export interface CustomerRepository {
  /** Throws DomainError "DUPLICATE" with `details.field` "name" when the name is taken. */
  insert(customer: CustomerRecord): Promise<{ id: string; code: number }>;
  /** Same duplicate rule as insert; NOT_FOUND when the customer doesn't exist. */
  update(id: string, customer: CustomerRecord): Promise<void>;
  findForEdit(id: string): Promise<CustomerFormData | undefined>;
  findDetail(id: string): Promise<CustomerDetail | undefined>;
  search(query: CustomerQuery): Promise<{ items: CustomerListItem[]; total: number }>;
  /** Active customers by name, for pickers. */
  activeOptions(): Promise<CustomerOption[]>;
  /** NOT_FOUND when the customer doesn't exist. */
  setActive(id: string, active: boolean): Promise<void>;
  /** Closes the open portfolio assignment and, with a technician, opens a new one. */
  assignTechnician(customerId: string, technicianId: string | null): Promise<void>;
  /** Every active customer with today's technician, by name. */
  portfolioList(): Promise<PortfolioCustomer[]>;
  /** Today's technician of each customer, by id; unknown ids are left out. */
  technicianOf(customerIds: readonly string[]): Promise<Map<string, string | null>>;
  /** Changes only the customer's technician column; the history goes through assignTechnician. */
  setTechnician(customerId: string, technicianId: string | null): Promise<void>;
  /** The localities already written, each once, for suggestions (D48). */
  localities(): Promise<string[]>;
  /** Whether a customer goes by this comparison name. */
  nameTaken(comparisonName: string): Promise<boolean>;
  /** DUPLICATE with `details.field` "name" when another customer already has that alias. */
  addAlias(
    customerId: string,
    alias: { name: string; comparisonName: string },
    actorId: string,
  ): Promise<{ id: string }>;
  /** NOT_FOUND when the alias isn't this customer's. */
  removeAlias(customerId: string, aliasId: string): Promise<{ name: string }>;
  addProperty(customerId: string, property: PropertyRecord): Promise<{ id: string }>;
  /** NOT_FOUND when the property isn't an active one of this customer. */
  deactivateProperty(customerId: string, propertyId: string): Promise<void>;
  addReceiver(customerId: string, receiver: ReceiverRecord): Promise<{ id: string }>;
  deactivateReceiver(customerId: string, receiverId: string): Promise<void>;
}

export type Zone = { id: string; name: string };

/** A zone on the zones page: deactivated ones are listed too, with how many customers they have. */
export type ZoneListItem = Zone & { isActive: boolean; customerCount: number };

export interface ZoneRepository {
  /** Throws DomainError "DUPLICATE" with `details.field` "name". */
  insert(zone: ZoneRecord): Promise<{ id: string }>;
  /** Active zones, the ones offered for customers. */
  list(): Promise<Zone[]>;
  listAll(): Promise<ZoneListItem[]>;
  find(id: string): Promise<(Zone & { isActive: boolean }) | undefined>;
  /** Whether the zone exists and is active. */
  exists(id: string): Promise<boolean>;
  /** Same duplicate rule as insert; NOT_FOUND when the zone doesn't exist. */
  rename(id: string, zone: ZoneRecord): Promise<void>;
  /** NOT_FOUND when the zone doesn't exist. */
  setActive(id: string, active: boolean): Promise<void>;
}

export type Technician = { id: string; name: string };

/** Active sales technicians, read from the identity module. */
export interface TechnicianLookup {
  listActive(): Promise<Technician[]>;
  isActiveTechnician(userId: string): Promise<boolean>;
}
