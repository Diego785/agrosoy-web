import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { testDb } from "@test/test-database";
import { createCampaign } from "@/modules/campaigns/application/campaign-use-cases";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { createZone } from "@/modules/customers/application/customer-use-cases";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import {
  addPresentation,
  createProduct,
  listProducts,
  priceSheet,
  referencePrice,
  savePrices,
  updateProduct,
} from "../application/catalog-use-cases";
import { catalogLookups } from "./catalog-lookups";
import { drizzlePriceRepository, drizzleProductRepository } from "./drizzle-catalog-repositories";

const admin = actorWithRole("admin");

function deps() {
  return {
    products: drizzleProductRepository(testDb),
    prices: drizzlePriceRepository(testDb),
    lookups: catalogLookups(testDb),
    audit: drizzleAuditTrail(testDb),
  };
}

const fulvin = {
  name: "Fulvin 40-22",
  line: "fertilizers",
  presentations: [{ content: "20", unit: "l", saleUnit: "measure" }],
};

async function campaignAndZone() {
  const audit = drizzleAuditTrail(testDb);
  const { id: campaignId } = await createCampaign(
    { campaigns: drizzleCampaignRepository(testDb), audit },
    admin,
    {
      season: "summer",
      year: 2026,
      startsOn: "2026-10-01",
      endsOn: "2027-03-31",
    },
  );
  const { id: zoneId } = await createZone({ zones: drizzleZoneRepository(testDb), audit }, admin, {
    name: "Cuatro Cañadas",
  });
  return { campaignId, zoneId };
}

describe("products", () => {
  it("creates a product with its presentations and an automatic code", async () => {
    const { code } = await createProduct(deps(), admin, fulvin);
    const { id } = await createProduct(deps(), admin, {
      name: "4-energy",
      line: "agrochemicals",
      presentations: [
        { content: "250", unit: "ml", saleUnit: "container" },
        { content: "1", unit: "l", saleUnit: "container" },
      ],
    });

    expect(code).toBe(1);
    const products = await listProducts(deps(), actorWithRole("sales_technician"), { text: "" });
    expect(products.map((product) => product.name)).toEqual(["4-energy", "Fulvin 40-22"]);
    expect(products[0]).toMatchObject({ id, line: "agrochemicals" });
    expect(products[0]?.presentations.map((p) => `${p.content} ${p.unit}`)).toEqual([
      "1.000 l",
      "250.000 ml",
    ]);
  });

  it("rejects repeated names and presentations", async () => {
    const { id } = await createProduct(deps(), admin, fulvin);
    await expect(createProduct(deps(), admin, { ...fulvin, name: "fulvin  40-22" })).rejects.toMatchObject({
      code: "DUPLICATE",
      details: { field: "name" },
    });
    await expect(
      addPresentation(deps(), admin, id, { content: "20.0", unit: "l", saleUnit: "container" }),
    ).rejects.toMatchObject({ code: "DUPLICATE", details: { field: "content" } });
    await expect(
      createProduct(deps(), admin, {
        ...fulvin,
        name: "Otro",
        presentations: [fulvin.presentations[0], fulvin.presentations[0]],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("finds products by name or code and edits them", async () => {
    const { id } = await createProduct(deps(), admin, fulvin);
    await updateProduct(deps(), admin, id, { name: "Fulvin 40-22 Plus", line: "fertilizers" });
    expect((await listProducts(deps(), admin, { text: "plus" })).map((p) => p.name)).toEqual([
      "Fulvin 40-22 Plus",
    ]);
    expect((await listProducts(deps(), admin, { text: "0001" })).map((p) => p.name)).toEqual([
      "Fulvin 40-22 Plus",
    ]);
    expect(await listProducts(deps(), admin, { text: "", line: "agrochemicals" })).toEqual([]);
  });

  it("only lets catalog managers change products", async () => {
    await expect(createProduct(deps(), actorWithRole("sales_technician"), fulvin)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("reference prices", () => {
  it("keeps a general price and zone prices, and suggests the zone's first", async () => {
    const { campaignId, zoneId } = await campaignAndZone();
    await createProduct(deps(), admin, fulvin);
    const [row] = await priceSheet(deps(), admin, { campaignId });
    const presentationId = row!.presentation.id;

    await savePrices(deps(), admin, { campaignId, zoneId: "", prices: [{ presentationId, price: "9" }] });
    await savePrices(deps(), admin, { campaignId, zoneId, prices: [{ presentationId, price: "8,50" }] });
    // Saving again updates instead of failing on the unique key.
    await savePrices(deps(), admin, { campaignId, zoneId: "", prices: [{ presentationId, price: "9.25" }] });

    expect((await priceSheet(deps(), admin, { campaignId }))[0]?.price).toBe("9.25");
    expect(await referencePrice(deps(), { campaignId, zoneId, presentationId })).toBe("8.50");
    expect(await referencePrice(deps(), { campaignId, zoneId: null, presentationId })).toBe("9.25");

    await savePrices(deps(), admin, { campaignId, zoneId, prices: [{ presentationId, price: "" }] });
    expect(await referencePrice(deps(), { campaignId, zoneId, presentationId })).toBe("9.25");
  });

  it("rejects unknown campaigns and malformed prices", async () => {
    const { campaignId } = await campaignAndZone();
    const { id } = await createProduct(deps(), admin, fulvin);
    await expect(
      savePrices(deps(), admin, { campaignId: crypto.randomUUID(), prices: [] }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      savePrices(deps(), admin, { campaignId, prices: [{ presentationId: id, price: "9.999" }] }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
