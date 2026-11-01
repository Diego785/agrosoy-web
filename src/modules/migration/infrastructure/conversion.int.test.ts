import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { salesWorkbook } from "@test/sales-workbook";
import { testDb } from "@test/test-database";
import { createProduct, listProducts } from "@/modules/catalog/application/catalog-use-cases";
import { drizzleProductRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repositories";
import { registerCustomer, searchCustomers } from "@/modules/customers/application/customer-use-cases";
import { drizzleCustomerRepository } from "@/modules/customers/infrastructure/drizzle-customer-repository";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import { identityTechnicianLookup } from "@/modules/customers/infrastructure/identity-technician-lookup";
import { newUserAccount } from "@/modules/identity/domain/user-account";
import { drizzleUserDirectory } from "@/modules/identity/infrastructure/drizzle-user-directory";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { conversionPreview, convertCustomers, convertProducts } from "../application/conversion";
import { importSalesWorkbook } from "../application/import-use-cases";
import { conversionDeps } from "./conversion-adapters";
import { drizzleImportRepository } from "./drizzle-import-repository";
import { exceljsWorkbookReader } from "./exceljs-workbook-reader";

const admin = actorWithRole("admin");

async function importedBatch() {
  const { sheets } = await importSalesWorkbook(
    {
      imports: drizzleImportRepository(testDb),
      workbooks: exceljsWorkbookReader,
      audit: drizzleAuditTrail(testDb),
    },
    admin,
    { fileName: "ventas.xlsx", content: await salesWorkbook() },
  );
  return sheets[0]!.batchId;
}

const customerDeps = () => ({
  customers: drizzleCustomerRepository(testDb),
  zones: drizzleZoneRepository(testDb),
  technicians: identityTechnicianLookup(testDb),
  audit: drizzleAuditTrail(testDb),
});

describe("converting an imported sheet", () => {
  it("previews customers and products, matching what already exists", async () => {
    const { id: favioId } = await drizzleUserDirectory(testDb).create(
      newUserAccount({ name: "Favio Añez", username: "fanez", role: "sales_technician" }),
      "temporary-password",
    );
    await registerCustomer(customerDeps(), admin, { name: "rodolfo  romero", exchangeRateKind: "daily" });
    const batchId = await importedBatch();

    const preview = await conversionPreview(conversionDeps(testDb, admin), admin, batchId);
    expect(preview.suggestedTechnicianId).toBe(favioId);
    expect(preview.customers.map((c) => [c.name, c.existing !== null])).toEqual([
      ["Alexander Jimenez", false],
      ["Andres Kaoru Matsudo", false],
      ["Rodolfo Romero", true],
    ]);
    expect(
      preview.products.map((p) => [p.name, p.presentations.map((x) => `${x.content} ${x.unit}`)]),
    ).toEqual([
      ["4-energy", ["250.000 ml"]],
      ["Biogain Amino Como", ["1.000 l"]],
      ["Fulvin 40-22", ["20.000 l"]],
    ]);
    expect(preview.unreadableProducts).toEqual([]);
  });

  it("registers only missing customers, with the chosen technician", async () => {
    const { id: favioId } = await drizzleUserDirectory(testDb).create(
      newUserAccount({ name: "Favio Añez", username: "fanez", role: "sales_technician" }),
      "temporary-password",
    );
    const batchId = await importedBatch();
    const deps = conversionDeps(testDb, admin);

    expect(await convertCustomers(deps, admin, { batchId, technicianId: favioId })).toEqual({ created: 3 });
    expect(await convertCustomers(deps, admin, { batchId, technicianId: favioId })).toEqual({ created: 0 });
    const { items } = await searchCustomers(customerDeps(), admin, { text: "" });
    expect(items.map((c) => [c.name, c.technicianName])).toEqual([
      ["Alexander Jimenez", "Favio Añez"],
      ["Andres Kaoru Matsudo", "Favio Añez"],
      ["Rodolfo Romero", "Favio Añez"],
    ]);
  });

  it("creates products and missing presentations only with a decision", async () => {
    await createProduct(
      { products: drizzleProductRepository(testDb), audit: drizzleAuditTrail(testDb) },
      admin,
      {
        name: "4-Energy",
        line: "agrochemicals",
        presentations: [{ content: "1", unit: "l", saleUnit: "container" }],
      },
    );
    const batchId = await importedBatch();

    const result = await convertProducts(conversionDeps(testDb, admin), admin, {
      batchId,
      decisions: [
        { key: "fulvin 40-22", line: "fertilizers", saleUnit: "measure" },
        { key: "4-energy", saleUnit: "container" },
      ],
    });
    expect(result).toEqual({ createdProducts: 1, addedPresentations: 1, skipped: ["Biogain Amino Como"] });

    const products = await listProducts({ products: drizzleProductRepository(testDb) }, admin, { text: "" });
    expect(
      products.map((p) => [
        p.name,
        p.line,
        p.presentations.map((x) => `${x.content} ${x.unit} ${x.saleUnit}`),
      ]),
    ).toEqual([
      ["4-Energy", "agrochemicals", ["1.000 l container", "250.000 ml container"]],
      ["Fulvin 40-22", "fertilizers", ["20.000 l measure"]],
    ]);
  });

  it("is only for administration and management", async () => {
    const batchId = await importedBatch();
    const technician = actorWithRole("sales_technician");
    await expect(
      conversionPreview(conversionDeps(testDb, technician), technician, batchId),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
