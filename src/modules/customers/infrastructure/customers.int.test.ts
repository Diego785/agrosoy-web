import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { testDb } from "@test/test-database";
import { newUserAccount } from "@/modules/identity/domain/user-account";
import { drizzleUserDirectory } from "@/modules/identity/infrastructure/drizzle-user-directory";
import type { Actor } from "@/shared/application/actor";
import type { Role } from "@/shared/domain/role";
import { auditLog } from "@/shared/infrastructure/audit/audit-log.table";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import {
  createZone,
  customerFormOptions,
  getCustomerForEdit,
  registerCustomer,
  searchCustomers,
  updateCustomer,
} from "../application/customer-use-cases";
import { drizzleCustomerRepository } from "./drizzle-customer-repository";
import { drizzleZoneRepository } from "./drizzle-zone-repository";
import { identityTechnicianLookup } from "./identity-technician-lookup";

const admin = actorWithRole("admin");

function depsFor(executor: DbExecutor) {
  return {
    customers: drizzleCustomerRepository(executor),
    zones: drizzleZoneRepository(executor),
    technicians: identityTechnicianLookup(executor),
    audit: drizzleAuditTrail(executor),
  };
}

function inTransaction<T>(work: (deps: ReturnType<typeof depsFor>) => Promise<T>): Promise<T> {
  return testDb.transaction((tx) => work(depsFor(tx)));
}

const register = (input: object, actor: Actor = admin) =>
  inTransaction((deps) => registerCustomer(deps, actor, { exchangeRateKind: "daily", ...input }));

const search = (input: object, actor: Actor = admin) => searchCustomers(depsFor(testDb), actor, input);

async function user(name: string, role: Role): Promise<Actor> {
  const { id } = await drizzleUserDirectory(testDb).create(
    newUserAccount({ name, username: name.toLowerCase().replace(/\W/g, ""), role }),
    "temporary-password",
  );
  return actorWithRole(role, id, name);
}

describe("customers", () => {
  it("registers a customer with the next automatic code and records who did it", async () => {
    const first = await register({ name: "Eduardo  Cuaquira" });
    const second = await register({ name: "Agro Sur SRL", taxId: "1023456-LP" });

    expect([first.code, second.code]).toEqual([1, 2]);
    const { items } = await search({ text: "cuaquira" });
    expect(items).toMatchObject([{ id: first.id, code: 1, name: "Eduardo Cuaquira" }]);
    expect(await testDb.$count(auditLog)).toBe(2);
  });

  it("rejects a name that differs only in accents or case, and writes nothing", async () => {
    await register({ name: "José Añez" });
    await expect(register({ name: "jose  AÑEZ" })).rejects.toMatchObject({
      code: "DUPLICATE",
      details: { field: "name" },
    });
    expect(await testDb.$count(auditLog)).toBe(1);
  });

  it("stores the exchange-rate agreement and requires the rate when it is fixed", async () => {
    const { id } = await register({ name: "Agro Sur", exchangeRateKind: "fixed", fixedExchangeRate: "6.96" });
    expect(await inTransaction((deps) => getCustomerForEdit(deps, admin, id))).toMatchObject({
      exchangeRateKind: "fixed",
      fixedExchangeRate: "6.9600",
    });

    await expect(register({ name: "Sin Tipo", exchangeRateKind: "fixed" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { fixedExchangeRate: [expect.any(String)] } },
    });
  });

  it("assigns zone and technician, and refuses users who aren't active technicians", async () => {
    const favio = await user("Favio Añez", "sales_technician");
    const keeper = await user("Almacen Norte", "warehouse_keeper");
    const { id: zoneId } = await inTransaction((deps) => createZone(deps, admin, { name: "Cuatro Cañadas" }));

    await register({ name: "Eduardo Cuaquira", zoneId, technicianId: favio.id });
    const { items } = await search({ text: "" });
    expect(items[0]).toMatchObject({ zoneName: "Cuatro Cañadas", technicianName: "Favio Añez" });

    await expect(register({ name: "Otro Cliente", technicianId: keeper.id })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { technicianId: [expect.any(String)] } },
    });
    const options = await inTransaction((deps) => customerFormOptions(deps, admin));
    expect(options.technicians).toEqual([{ id: favio.id, name: "Favio Añez" }]);
  });

  it("updates a customer and clears fields emptied in the form", async () => {
    const { id } = await register({ name: "Agro Sur", phone: "70000000", notes: "Paga en Montero" });
    await inTransaction((deps) =>
      updateCustomer(deps, admin, id, {
        name: "Agro Sur SRL",
        phone: "",
        notes: "",
        exchangeRateKind: "daily",
      }),
    );

    expect(await inTransaction((deps) => getCustomerForEdit(deps, admin, id))).toMatchObject({
      name: "Agro Sur SRL",
      phone: null,
      notes: null,
    });
    await expect(
      inTransaction((deps) =>
        updateCustomer(deps, admin, crypto.randomUUID(), { name: "Nadie", exchangeRateKind: "daily" }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("finds customers by code with or without leading zeros, and by tax id", async () => {
    await register({ name: "Cliente Uno" });
    await register({ name: "Cliente Dos", taxId: "4455667" });

    expect((await search({ text: "0002" })).items.map((c) => c.name)).toEqual(["Cliente Dos"]);
    expect((await search({ text: "2" })).items.map((c) => c.name)).toEqual(["Cliente Dos"]);
    expect((await search({ text: "4455" })).items.map((c) => c.name)).toEqual(["Cliente Dos"]);
    expect((await search({ text: "%" })).total).toBe(0);
  });

  it("shows a technician's own customers first, and lets everyone look up any customer", async () => {
    const favio = await user("Favio Añez", "sales_technician");
    await register({ name: "Aaa Primero" });
    await register({ name: "Zzz De Favio", technicianId: favio.id });

    expect((await search({ text: "" }, favio)).items.map((c) => c.name)).toEqual([
      "Zzz De Favio",
      "Aaa Primero",
    ]);
    expect((await search({ text: "" }, admin)).items.map((c) => c.name)).toEqual([
      "Aaa Primero",
      "Zzz De Favio",
    ]);
    await expect(search({ text: "" }, actorWithRole("warehouse_keeper"))).resolves.toMatchObject({
      total: 2,
    });
  });

  it("only lets administration and management change customers", async () => {
    const favio = await user("Favio Añez", "sales_technician");
    await expect(register({ name: "Cliente Nuevo" }, favio)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(inTransaction((deps) => createZone(deps, favio, { name: "Norte" }))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects a repeated zone name", async () => {
    await inTransaction((deps) => createZone(deps, admin, { name: "Cuatro Cañadas" }));
    await expect(
      inTransaction((deps) => createZone(deps, admin, { name: "cuatro cañadas" })),
    ).rejects.toMatchObject({ code: "DUPLICATE", details: { field: "name" } });
  });
});
