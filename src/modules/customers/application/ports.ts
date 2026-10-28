import type { CustomerRecord } from "../domain/customer";
import type { ZoneRecord } from "../domain/zone";

export type CustomerListItem = {
  id: string;
  code: number;
  name: string;
  taxId: string | null;
  phone: string | null;
  zoneName: string | null;
  technicianName: string | null;
};

export type CustomerFormData = {
  id: string;
  code: number;
  name: string;
  taxId: string | null;
  phone: string | null;
  zoneId: string | null;
  technicianId: string | null;
  exchangeRateKind: "daily" | "fixed";
  /** "6.9600" or null. */
  fixedExchangeRate: string | null;
  notes: string | null;
};

export type CustomerQuery = {
  /** Already normalized with normalizeForComparison; empty lists everyone. */
  text: string;
  zoneId?: string;
  /** Customers of this technician come first (each technician sees their portfolio first). */
  preferTechnicianId?: string;
  limit: number;
  offset: number;
};

export interface CustomerRepository {
  /** Throws DomainError "DUPLICATE" with `details.field` "name" when the name is taken. */
  insert(customer: CustomerRecord): Promise<{ id: string; code: number }>;
  /** Same duplicate rule as insert; NOT_FOUND when the customer doesn't exist. */
  update(id: string, customer: CustomerRecord): Promise<void>;
  findForEdit(id: string): Promise<CustomerFormData | undefined>;
  search(query: CustomerQuery): Promise<{ items: CustomerListItem[]; total: number }>;
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
