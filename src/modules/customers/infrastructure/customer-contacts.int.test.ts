import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { testDb } from "@test/test-database";
import { newUserAccount } from "@/modules/identity/domain/user-account";
import { drizzleUserDirectory } from "@/modules/identity/infrastructure/drizzle-user-directory";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import {
  addAuthorizedReceiver,
  addCustomerProperty,
  getCustomerDetail,
  registerCustomer,
  removeAuthorizedReceiver,
  removeCustomerProperty,
  searchCustomers,
  setCustomerActive,
  updateCustomer,
} from "../application/customer-use-cases";
import { drizzleCustomerRepository } from "./drizzle-customer-repository";
import { drizzleZoneRepository } from "./drizzle-zone-repository";
import { identityTechnicianLookup } from "./identity-technician-lookup";

const admin = actorWithRole("admin");

function deps() {
  return {
    customers: drizzleCustomerRepository(testDb),
    zones: drizzleZoneRepository(testDb),
    technicians: identityTechnicianLookup(testDb),
    audit: drizzleAuditTrail(testDb),
  };
}

async function technician(name: string) {
  const { id } = await drizzleUserDirectory(testDb).create(
    newUserAccount({ name, username: name.toLowerCase().replace(/\W/g, ""), role: "sales_technician" }),
    "temporary-password",
  );
  return id;
}

const register = (input: object) => registerCustomer(deps(), admin, { exchangeRateKind: "daily", ...input });

describe("customer page", () => {
  it("keeps the portfolio history when the technician changes", async () => {
    const favio = await technician("Favio Añez");
    const rene = await technician("Rene Gonzales");
    const { id } = await register({ name: "Roberto Mamani", technicianId: favio });

    await updateCustomer(deps(), admin, id, {
      name: "Roberto Mamani",
      technicianId: rene,
      exchangeRateKind: "daily",
    });
    // Saving without changing the technician doesn't add history.
    await updateCustomer(deps(), admin, id, {
      name: "Roberto Mamani",
      technicianId: rene,
      exchangeRateKind: "daily",
      phone: "7000",
    });

    const detail = await getCustomerDetail(deps(), actorWithRole("warehouse_keeper"), id);
    expect(detail.technicianName).toBe("Rene Gonzales");
    expect(detail.assignments.map((a) => [a.technicianName, a.endsAt === null])).toEqual([
      ["Rene Gonzales", true],
      ["Favio Añez", false],
    ]);
  });

  it("adds and removes properties and authorized receivers", async () => {
    const { id } = await register({ name: "Agro Sur" });
    const { id: propertyId } = await addCustomerProperty(deps(), admin, id, {
      name: " Estancia  El Carmen ",
      location: "Cuatro Cañadas, km 12",
    });
    await addAuthorizedReceiver(deps(), admin, id, {
      name: "Juan Pérez",
      documentId: "123 456-sc",
      relationship: "Hijo",
    });

    let detail = await getCustomerDetail(deps(), admin, id);
    expect(detail.properties).toEqual([
      { id: propertyId, name: "Estancia El Carmen", location: "Cuatro Cañadas, km 12" },
    ]);
    expect(detail.receivers).toMatchObject([
      { name: "Juan Pérez", documentId: "123456SC", relationship: "Hijo" },
    ]);

    await removeCustomerProperty(deps(), admin, id, propertyId);
    await removeAuthorizedReceiver(deps(), admin, id, detail.receivers[0]!.id);
    detail = await getCustomerDetail(deps(), admin, id);
    expect(detail.properties).toEqual([]);
    expect(detail.receivers).toEqual([]);
    await expect(removeCustomerProperty(deps(), admin, id, propertyId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("requires the receiver's position or kinship", async () => {
    const { id } = await register({ name: "Agro Sur" });
    await expect(
      addAuthorizedReceiver(deps(), admin, id, { name: "Juan Pérez", relationship: "" }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { relationship: expect.any(Array) } },
    });
  });

  it("hides deactivated customers from the list until reactivated", async () => {
    const { id } = await register({ name: "Agro Sur" });
    await setCustomerActive(deps(), admin, id, false);

    expect((await searchCustomers(deps(), admin, { text: "" })).total).toBe(0);
    expect((await searchCustomers(deps(), admin, { text: "", status: "inactive" })).total).toBe(1);
    expect((await getCustomerDetail(deps(), admin, id)).isActive).toBe(false);

    await setCustomerActive(deps(), admin, id, true);
    expect((await searchCustomers(deps(), admin, { text: "" })).total).toBe(1);
  });

  it("only lets customer managers change contacts", async () => {
    const { id } = await register({ name: "Agro Sur" });
    await expect(
      addCustomerProperty(deps(), actorWithRole("sales_technician"), id, { name: "El Carmen" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      setCustomerActive(deps(), actorWithRole("sales_technician"), id, false),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
