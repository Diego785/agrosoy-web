import Link from "next/link";
import { notFound } from "next/navigation";
import { listCampaigns } from "@/modules/campaigns/application/campaign-use-cases";
import { campaignOn } from "@/modules/campaigns/domain/campaign";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { listZones } from "@/modules/customers/application/customer-use-cases";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { can } from "@/shared/application/permissions";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { buttonVariants } from "@/shared/presentation/ui/button";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import { getProduct, listProducts, priceSheet } from "../application/catalog-use-cases";
import { PRODUCT_LINES } from "../domain/product";
import { catalogDeps } from "./catalog-deps";
import { LINE_LABELS, SALE_UNIT_LABELS, contentLabel } from "./catalog-labels";
import { PRICES_PATH, PRODUCTS_PATH, productPath } from "./catalog-routes";
import { PriceSheetForm } from "./price-sheet-form";
import { AddPresentationForm, EditProductForm } from "./product-forms";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export async function ProductsTable({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actor = await requireActor();
  const text = first(params.q)?.trim() ?? "";
  const line = first(params.line) ?? "";
  const products = await listProducts(catalogDeps(getDb()), actor, { text, line: line || undefined });

  return (
    <div className="flex flex-col gap-4">
      <form action={PRODUCTS_PATH} className="flex flex-wrap gap-2">
        <Input
          name="q"
          defaultValue={text}
          placeholder="Nombre o código"
          aria-label="Buscar producto"
          className="max-w-xs"
        />
        <NativeSelect name="line" defaultValue={line} aria-label="Línea">
          <NativeSelectOption value="">Todas las líneas</NativeSelectOption>
          {PRODUCT_LINES.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {LINE_LABELS[option]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Buscar
        </button>
      </form>
      {products.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {text || line ? "Ningún producto coincide con la búsqueda." : "Todavía no hay productos."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Código</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Línea</TableHead>
              <TableHead>Presentaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {String(product.code).padStart(4, "0")}
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={productPath(product.id)} className="hover:underline">
                    {product.name}
                  </Link>
                </TableCell>
                <TableCell>{LINE_LABELS[product.line]}</TableCell>
                <TableCell>{product.presentations.map(contentLabel).join(" · ")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  const product = await getProduct(catalogDeps(getDb()), actor, id).catch((error: unknown) => {
    if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED"))
      notFound();
    throw error;
  });
  const canEdit = can(actor, "catalog.manage");

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {canEdit ? (
        <EditProductForm product={product} />
      ) : (
        <p>
          <span className="text-lg font-semibold">{product.name}</span> · {LINE_LABELS[product.line]}
        </p>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Presentaciones</h2>
        <ul className="divide-y rounded-lg border">
          {product.presentations.map((presentation) => (
            <li key={presentation.id} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="font-medium">{contentLabel(presentation)}</span>
              <span className="text-muted-foreground">Precio {SALE_UNIT_LABELS[presentation.saleUnit]}</span>
            </li>
          ))}
        </ul>
        {canEdit && <AddPresentationForm productId={product.id} />}
      </section>
    </div>
  );
}

/** Reference prices for a campaign and a zone ("" = general price), chosen in the URL. */
export async function PriceSheet({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actor = await requireActor();
  const db = getDb();
  const [campaigns, zones] = await Promise.all([
    listCampaigns({ campaigns: drizzleCampaignRepository(db) }, actor),
    listZones({ zones: drizzleZoneRepository(db) }, actor),
  ]);
  if (campaigns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Primero crea una campaña: los precios son de cada campaña.
      </p>
    );
  }

  const requested = campaigns.find((campaign) => campaign.id === first(params.campaign));
  const campaign = requested ?? campaignOn(campaigns, todayInBolivia()) ?? campaigns[0]!;
  const zoneId = zones.some((zone) => zone.id === first(params.zone)) ? (first(params.zone) ?? "") : "";
  const deps = catalogDeps(db);
  const [sheet, general] = await Promise.all([
    priceSheet(deps, actor, { campaignId: campaign.id, zoneId }),
    zoneId ? priceSheet(deps, actor, { campaignId: campaign.id }) : Promise.resolve([]),
  ]);
  const generalByPresentation = new Map(general.map((row) => [row.presentation.id, row.price]));
  const canEdit = can(actor, "catalog.manage");

  return (
    <div className="flex flex-col gap-6">
      <form action={PRICES_PATH} className="flex flex-wrap gap-2">
        <NativeSelect name="campaign" defaultValue={campaign.id} aria-label="Campaña">
          {campaigns.map((option) => (
            <NativeSelectOption key={option.id} value={option.id}>
              {campaignLabel(option)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="zone" defaultValue={zoneId} aria-label="Zona">
          <NativeSelectOption value="">Precio general (todas las zonas)</NativeSelectOption>
          {zones.map((zone) => (
            <NativeSelectOption key={zone.id} value={zone.id}>
              {zone.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Ver
        </button>
      </form>
      {zoneId && (
        <p className="text-sm text-muted-foreground">
          Deja vacío el precio de la zona para usar el general (se muestra en gris).
        </p>
      )}
      {sheet.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay productos.</p>
      ) : canEdit ? (
        <PriceSheetForm
          key={`${campaign.id}:${zoneId}`}
          campaignId={campaign.id}
          zoneId={zoneId}
          rows={sheet.map((row) => ({
            presentationId: row.presentation.id,
            productName: row.product.name,
            line: row.product.line,
            content: row.presentation.content,
            unit: row.presentation.unit,
            saleUnit: row.presentation.saleUnit,
            price: row.price ?? "",
            generalPrice: generalByPresentation.get(row.presentation.id) ?? null,
          }))}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Presentación</TableHead>
              <TableHead className="text-right">Precio US$</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sheet.map((row) => (
              <TableRow key={row.presentation.id}>
                <TableCell>{row.product.name}</TableCell>
                <TableCell>{contentLabel(row.presentation)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.price ?? generalByPresentation.get(row.presentation.id) ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
