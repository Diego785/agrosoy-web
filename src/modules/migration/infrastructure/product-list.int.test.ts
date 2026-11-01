import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { productListWorkbook } from "@test/product-list-workbook";
import { salesWorkbook } from "@test/sales-workbook";
import { testDb } from "@test/test-database";
import { createCampaign } from "@/modules/campaigns/application/campaign-use-cases";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { createProduct, listProducts, priceSheet } from "@/modules/catalog/application/catalog-use-cases";
import { catalogDeps } from "@/modules/catalog/presentation/catalog-deps";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { importProductList, previewProductList } from "../application/product-list-import";
import { productListDeps } from "./conversion-adapters";

const admin = actorWithRole("admin");
const deps = () => productListDeps(testDb, admin);

async function summerCampaign() {
  const { id } = await createCampaign(
    { campaigns: drizzleCampaignRepository(testDb), audit: drizzleAuditTrail(testDb) },
    admin,
    { season: "summer", year: 2026, startsOn: "2026-10-01", endsOn: "2027-03-31" },
  );
  return id;
}

const file = async (options?: { fulvinPrice?: number }) => ({
  fileName: "PRODUCTOS.xlsx",
  content: await productListWorkbook(options),
});

describe("importing Agrosoy's product list", () => {
  it("previews the list against an empty catalog", async () => {
    const preview = await previewProductList(deps(), admin, await file());
    expect(preview.counts).toEqual({
      newProducts: 4,
      newPresentations: 5,
      existing: 0,
      conflicts: 0,
      prices: 4,
    });
    expect(preview.skipped.map((row) => [row.code, row.reason])).toEqual([["079", "CHARGE_CONCEPT"]]);
    expect(await listProducts(catalogDeps(testDb), admin, { text: "" })).toEqual([]);
  });

  it("creates products with Agrosoy's codes and the campaign's general prices; again, nothing new", async () => {
    const campaignId = await summerCampaign();
    await importProductList(deps(), admin, { ...(await file()), campaignId });

    const products = await listProducts(catalogDeps(testDb), admin, { text: "" });
    expect(products.map((p) => [p.name, p.line, p.presentations.map((x) => x.code)])).toEqual([
      ["4-Energy", "fertilizers", ["026"]],
      ["Fulvin 40-22", "fertilizers", ["001", "002"]],
      ["Oberon", "agrochemicals", ["051"]],
      ["Papel Hidrosensible", "fertilizers", ["020"]],
    ]);
    const prices = await priceSheet(catalogDeps(testDb), admin, { campaignId });
    expect(prices.map((row) => [row.presentation.code, row.presentation.saleUnit, row.price])).toEqual([
      ["026", "container", "70.00"],
      ["001", "measure", "7.80"],
      ["002", "measure", "8.30"],
      ["051", "container", null],
      ["020", "container", "12.00"],
    ]);

    const again = await importProductList(deps(), admin, {
      ...(await file({ fulvinPrice: 7.5 })),
      campaignId,
    });
    expect(again).toMatchObject({ newProducts: 0, newPresentations: 0, existing: 5 });
    expect((await priceSheet(catalogDeps(testDb), admin, { campaignId }))[1]?.price).toBe("7.50");
  });

  it("leaves out codes that belong to another presentation", async () => {
    await createProduct(catalogDeps(testDb), admin, {
      name: "Komus flex",
      line: "fertilizers",
      presentations: [{ code: "001", content: "1", unit: "l", saleUnit: "measure" }],
    });
    const preview = await previewProductList(deps(), admin, await file());
    expect(preview.rows.find((row) => row.code === "001")?.plan).toEqual({
      status: "conflict",
      reason: "code_taken",
      productName: "Komus flex",
      content: "1.000",
      unit: "l",
    });
    expect(preview.counts.conflicts).toBe(1);
  });

  it("rejects files without the list, unknown campaigns and other roles", async () => {
    await expect(
      previewProductList(deps(), admin, { fileName: "ventas.xlsx", content: await salesWorkbook() }),
    ).rejects.toMatchObject({ code: "INVALID_FILE" });
    await expect(
      importProductList(deps(), admin, { ...(await file()), campaignId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      previewProductList(deps(), actorWithRole("sales_technician"), await file()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
