import Link from "next/link";
import { notFound } from "next/navigation";
import { listCampaigns } from "@/modules/campaigns/application/campaign-use-cases";
import { campaignOn, previousCampaign } from "@/modules/campaigns/domain/campaign";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { listAllZones } from "@/modules/customers/application/customer-use-cases";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { can } from "@/shared/application/permissions";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import type { Actor } from "@/shared/application/actor";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { formatMoney } from "@/shared/presentation/format";
import { ResetOnLeave } from "@/shared/presentation/reset-on-leave";
import { CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import { ListPages, listHref, pageRows } from "@/shared/presentation/list-pages";
import { Badge } from "@/shared/presentation/ui/badge";
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
import type { ProductView } from "../application/catalog-ports";
import { getProduct, nextPresentationCode, priceSheet, productsPage } from "../application/catalog-use-cases";
import { PRODUCT_LINES } from "../domain/product";
import { catalogDeps } from "./catalog-deps";
import { LINE_LABELS, contentLabel, priceUnitLabel } from "./catalog-labels";
import { PRICES_PATH, PRODUCTS_PATH, productPath } from "./catalog-routes";
import { PriceSheetForm } from "./price-sheet-form";
import {
  AddPresentationForm,
  EditProductForm,
  NewProductForm,
  PresentationStatusButton,
  ProductStatusButton,
} from "./product-forms";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const formatPrice = (price: string | null | undefined) => (price ? formatMoney(price) : "—");

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export async function ProductsTable({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actor = await requireActor();
  const text = first(params.q)?.trim() ?? "";
  const line = first(params.line) ?? "";
  const status = first(params.status) === "inactive" ? "inactive" : "active";
  const db = getDb();
  const [list, prices] = await Promise.all([
    productsPage(catalogDeps(db), actor, {
      text,
      line: line || undefined,
      status,
      page: first(params.page),
      pages: first(params.pages),
    }),
    currentGeneralPrices(actor),
  ]);
  const products = list.items;
  const filters = { q: text, line, status: status === "inactive" ? status : undefined };

  return (
    <div className="flex flex-col gap-4">
      <ResetOnLeave key={`${text}|${line}|${status}`}>
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
          <NativeSelect name="status" defaultValue={status} aria-label="Estado">
            <NativeSelectOption value="active">Activos</NativeSelectOption>
            <NativeSelectOption value="inactive">Desactivados</NativeSelectOption>
          </NativeSelect>
          <button type="submit" className={buttonVariants({ variant: "outline" })}>
            Buscar
          </button>
        </form>
      </ResetOnLeave>
      {prices && (
        <p className="text-sm text-muted-foreground">
          Precios generales de {prices.label}, en US$.{" "}
          <Link href={PRICES_PATH} className="font-medium text-foreground hover:underline">
            Ver por zona o cambiarlos
          </Link>
        </p>
      )}
      {products.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {text || line
            ? "Ningún producto coincide con la búsqueda."
            : status === "inactive"
              ? "No hay productos desactivados."
              : "Todavía no hay productos."}
        </p>
      ) : (
        <>
          <WideOnly>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Línea</TableHead>
                  <TableHead>Presentaciones{prices ? `, con precio de ${prices.label}` : ""}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows(list).map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      <Link href={productPath(product.id)} className="hover:underline">
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell>{LINE_LABELS[product.line]}</TableCell>
                    <TableCell className="whitespace-normal">
                      <PresentationList
                        presentations={product.presentations}
                        prices={prices?.byPresentation}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </WideOnly>
          <CardList label="Productos">
            {products.map((product) => (
              <CardListItem key={product.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <Link href={productPath(product.id)} className="font-medium hover:underline">
                    {product.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">{LINE_LABELS[product.line]}</span>
                </div>
                <PresentationList presentations={product.presentations} prices={prices?.byPresentation} />
              </CardListItem>
            ))}
          </CardList>
        </>
      )}
      <ListPages
        list={list}
        href={(paging) => listHref(PRODUCTS_PATH, filters, paging)}
        noun={["producto", "productos"]}
      />
    </div>
  );
}

/** One line per presentation: code, content and, with a campaign, its general price. */
function PresentationList({
  presentations,
  prices,
}: {
  presentations: ProductView["presentations"];
  prices?: Map<string, string>;
}) {
  if (presentations.length === 0) {
    return <span className="text-muted-foreground">Sin presentaciones activas</span>;
  }
  return (
    <ul className="flex max-w-md flex-col gap-1">
      {presentations.map((presentation) => {
        const price = prices?.get(presentation.id);
        return (
          <li key={presentation.id} className="flex items-baseline gap-3 tabular-nums">
            <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{presentation.code}</span>
            <span className="min-w-16">{contentLabel(presentation)}</span>
            {prices && (
              <span className="ml-auto text-right">
                {price ? (
                  <>
                    {formatMoney(price)}{" "}
                    <span className="text-xs text-muted-foreground">por {priceUnitLabel(presentation)}</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">sin precio</span>
                )}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The general reference prices of the campaign running today (or the latest one), shown in the
 * products list. Zone prices stay on the prices page.
 */
async function currentGeneralPrices(actor: Actor) {
  const db = getDb();
  const campaigns = await listCampaigns({ campaigns: drizzleCampaignRepository(db) }, actor);
  const campaign = campaignOn(campaigns, todayInBolivia()) ?? campaigns[0];
  if (!campaign) return undefined;
  const sheet = await priceSheet(catalogDeps(db), actor, { campaignId: campaign.id });
  return {
    label: campaignLabel(campaign),
    byPresentation: new Map(sheet.flatMap((row) => (row.price ? [[row.presentation.id, row.price]] : []))),
  };
}

/** The new product form, proposing the first free code. */
export async function NewProduct() {
  const actor = await requireActor();
  return <NewProductForm nextCode={await nextPresentationCode(catalogDeps(getDb()), actor)} />;
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
  const nextCode = canEdit ? await nextPresentationCode(catalogDeps(getDb()), actor) : "";

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {!product.isActive && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm">
          <Badge variant="destructive">Desactivado</Badge>
          No se ofrece en nuevas boletas ni en los precios.
        </p>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        {canEdit ? (
          // Keyed by what it shows, so a change made elsewhere (an import) replaces stale values.
          <EditProductForm key={`${product.name}|${product.line}`} product={product} />
        ) : (
          <p>
            <span className="text-lg font-semibold">{product.name}</span> · {LINE_LABELS[product.line]}
          </p>
        )}
        {canEdit && <ProductStatusButton product={product} />}
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Presentaciones</h2>
        <ul className="divide-y rounded-lg border">
          {product.presentations.map((presentation) => (
            <li
              key={presentation.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm"
            >
              <span className={presentation.isActive ? "" : "text-muted-foreground"}>
                <span className="mr-1 font-mono text-xs text-muted-foreground">{presentation.code}</span>
                <span className="font-medium">{contentLabel(presentation)}</span>
                {!presentation.isActive && (
                  <Badge variant="outline" className="ml-2">
                    Desactivada
                  </Badge>
                )}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-muted-foreground">Precio por {priceUnitLabel(presentation)}</span>
                {canEdit && <PresentationStatusButton productId={product.id} presentation={presentation} />}
              </span>
            </li>
          ))}
        </ul>
        {canEdit && <AddPresentationForm key={nextCode} productId={product.id} nextCode={nextCode} />}
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
    listAllZones({ zones: drizzleZoneRepository(db) }, actor),
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
  const canEdit = can(actor, "catalog.manage");
  const previous = previousCampaign(campaigns, campaign);
  const copyFrom = canEdit && previous && first(params.copyFrom) === previous.id ? previous : undefined;
  const [sheet, general, copied] = await Promise.all([
    priceSheet(deps, actor, { campaignId: campaign.id, zoneId }),
    zoneId ? priceSheet(deps, actor, { campaignId: campaign.id }) : Promise.resolve([]),
    copyFrom ? priceSheet(deps, actor, { campaignId: copyFrom.id, zoneId }) : Promise.resolve([]),
  ]);
  const generalByPresentation = new Map(general.map((row) => [row.presentation.id, row.price]));
  // Copied prices only fill the empty ones; nothing is saved until "Guardar precios".
  const copiedByPresentation = new Map(copied.map((row) => [row.presentation.id, row.price]));
  const filled = sheet.filter((row) => !row.price && copiedByPresentation.get(row.presentation.id)).length;

  return (
    <div className="flex flex-col gap-6">
      <ResetOnLeave key={`${campaign.id}|${zoneId}`}>
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
                {zone.isActive ? zone.name : `${zone.name} (desactivada)`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <button type="submit" className={buttonVariants({ variant: "outline" })}>
            Ver
          </button>
        </form>
      </ResetOnLeave>
      {zoneId && (
        <p className="text-sm text-muted-foreground">
          Deja vacío el precio de la zona para usar el general (se muestra en gris).
        </p>
      )}
      {canEdit && previous && sheet.length > 0 && !copyFrom && (
        <Link
          href={`${PRICES_PATH}?${new URLSearchParams({ campaign: campaign.id, zone: zoneId, copyFrom: previous.id })}`}
          className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
        >
          Copiar precios de {campaignLabel(previous)}
        </Link>
      )}
      {copyFrom && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm">
          {filled === 0
            ? `${campaignLabel(copyFrom)} no tiene precios para los productos que aquí están vacíos.`
            : `Se completaron ${filled === 1 ? "1 precio" : `${filled} precios`} con los de ${campaignLabel(copyFrom)}. Revísalos y guarda; los que ya tenían precio no cambiaron.`}{" "}
          <Link
            href={`${PRICES_PATH}?${new URLSearchParams({ campaign: campaign.id, zone: zoneId })}`}
            className="font-medium hover:underline"
          >
            Descartar
          </Link>
        </p>
      )}
      {sheet.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay productos.</p>
      ) : canEdit ? (
        <PriceSheetForm
          // The saved prices are part of the key: after an import or a save elsewhere, the sheet
          // starts again from what is stored instead of keeping what it showed before.
          key={`${campaign.id}:${zoneId}:${copyFrom?.id ?? ""}:${sheet.map((row) => row.price ?? "").join(",")}`}
          campaignId={campaign.id}
          zoneId={zoneId}
          rows={sheet.map((row) => ({
            presentationId: row.presentation.id,
            code: row.presentation.code,
            productName: row.product.name,
            line: row.product.line,
            content: row.presentation.content,
            unit: row.presentation.unit,
            saleUnit: row.presentation.saleUnit,
            price: row.price ?? copiedByPresentation.get(row.presentation.id) ?? "",
            generalPrice: generalByPresentation.get(row.presentation.id) ?? null,
          }))}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Código</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Presentación</TableHead>
              <TableHead className="text-right">Precio US$</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sheet.map((row) => (
              <TableRow key={row.presentation.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {row.presentation.code}
                </TableCell>
                <TableCell>{row.product.name}</TableCell>
                <TableCell>{contentLabel(row.presentation)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPrice(row.price ?? generalByPresentation.get(row.presentation.id))}{" "}
                  <span className="text-xs text-muted-foreground">
                    por {priceUnitLabel(row.presentation)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
