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
import {
  CalendarRangeIcon,
  ChevronRightIcon,
  CircleOffIcon,
  CopyIcon,
  InfoIcon,
  PackageIcon,
  TagsIcon,
} from "lucide-react";
import { EmptyState } from "@/shared/presentation/empty-state";
import { LiveFilterForm } from "@/shared/presentation/live-filter-form";
import { SearchInput } from "@/shared/presentation/search-input";
import { ResetOnLeave } from "@/shared/presentation/reset-on-leave";
import { CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import { ListPages, listHref, pageRows } from "@/shared/presentation/list-pages";
import { Badge } from "@/shared/presentation/ui/badge";
import { buttonVariants } from "@/shared/presentation/ui/button";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import { getProduct, nextPresentationCode, priceSheet, productsPage } from "../application/catalog-use-cases";
import { PRODUCT_LINES } from "../domain/product";
import { catalogDeps } from "./catalog-deps";
import { LINE_LABELS, contentLabel, priceUnitLabel } from "./catalog-labels";
import { PRICES_PATH, PRODUCTS_PATH, productPath } from "./catalog-routes";
import { PriceSheetForm } from "./price-sheet-form";
import { LineMark, PresentationTags, presentationCount } from "./product-list-parts";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LiveFilterForm action={PRODUCTS_PATH} className="flex flex-1 flex-wrap items-center gap-2">
          <SearchInput
            name="q"
            defaultValue={text}
            placeholder="Nombre o código"
            aria-label="Buscar producto"
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
        </LiveFilterForm>
        {prices && (
          <Link
            href={PRICES_PATH}
            className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-xs hover:border-primary/40 hover:text-foreground"
          >
            <TagsIcon className="size-3.5 text-highlight" aria-hidden />
            Precios generales de <span className="font-medium text-foreground">{prices.label}</span> en US$
            <ChevronRightIcon className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      {products.length === 0 ? (
        <EmptyState
          icon={<PackageIcon />}
          title={text || line ? "Ningún producto coincide" : "Sin productos"}
        >
          {text || line
            ? "Prueba con otro nombre o código, o quita el filtro de línea."
            : status === "inactive"
              ? "No hay productos desactivados."
              : "Crea el primero o importa la lista de productos."}
        </EmptyState>
      ) : (
        <>
          <WideOnly>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[34%]">Producto</TableHead>
                  <TableHead>
                    {prices ? `Presentaciones y precios de ${prices.label}` : "Presentaciones"}
                  </TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Abrir</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows(list).map((product) => (
                  <TableRow key={product.id} className="group relative">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <LineMark line={product.line} />
                        <div className="min-w-0">
                          {/* The link covers the row, so the whole row opens the product. */}
                          <Link
                            href={productPath(product.id)}
                            className="block truncate font-medium group-hover:text-primary after:absolute after:inset-0"
                          >
                            {product.name}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {LINE_LABELS[product.line]} · {presentationCount(product.presentations)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <PresentationTags
                        presentations={product.presentations}
                        prices={prices?.byPresentation}
                        href={productPath(product.id)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <ChevronRightIcon
                        className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </WideOnly>
          <CardList label="Productos">
            {products.map((product) => (
              <CardListItem key={product.id} className="relative gap-3">
                <div className="flex items-center gap-3">
                  <LineMark line={product.line} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={productPath(product.id)}
                      className="block truncate font-medium after:absolute after:inset-0"
                    >
                      {product.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {LINE_LABELS[product.line]} · {presentationCount(product.presentations)}
                    </p>
                  </div>
                  <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
                </div>
                <PresentationTags
                  presentations={product.presentations}
                  prices={prices?.byPresentation}
                  href={productPath(product.id)}
                />
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
    <div className="flex max-w-4xl flex-col gap-6">
      <section className="rounded-xl border bg-card shadow-xs">
        <header className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="flex min-w-0 items-center gap-4">
            <LineMark line={product.line} className="size-12 rounded-xl [&>svg]:size-6" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{product.name}</h2>
                {product.isActive ? (
                  <Badge variant="success">Activo</Badge>
                ) : (
                  <Badge variant="destructive">Desactivado</Badge>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {LINE_LABELS[product.line]} · {presentationCount(product.presentations)}
              </p>
            </div>
          </div>
          {canEdit && <ProductStatusButton product={product} />}
        </header>
        {!product.isActive && (
          <p className="flex items-center gap-2 border-t bg-destructive/5 px-5 py-3 text-sm">
            <CircleOffIcon className="size-4 shrink-0 text-destructive" aria-hidden />
            No se ofrece en nuevas boletas ni en los precios.
          </p>
        )}
        {canEdit && (
          <div className="border-t p-5">
            {/* Keyed by what it shows, so a change made elsewhere (an import) replaces stale values. */}
            <EditProductForm key={`${product.name}|${product.line}`} product={product} />
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <header className="flex items-center gap-2 border-b px-5 py-3.5">
          <h3 className="text-sm font-semibold">Presentaciones</h3>
          {product.presentations.length > 0 && (
            <Badge variant="neutral">{product.presentations.length}</Badge>
          )}
        </header>
        {product.presentations.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">Sin presentaciones.</p>
        ) : (
          <ul className="divide-y">
            {product.presentations.map((presentation) => (
              <li
                key={presentation.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm"
              >
                <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                  {presentation.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={presentation.isActive ? "font-medium" : "font-medium text-muted-foreground"}
                  >
                    {contentLabel(presentation)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Precio por {priceUnitLabel(presentation)}
                  </span>
                </span>
                {presentation.isActive ? (
                  <Badge variant="success">Activa</Badge>
                ) : (
                  <Badge variant="destructive">Desactivada</Badge>
                )}
                {canEdit && <PresentationStatusButton productId={product.id} presentation={presentation} />}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="border-t bg-muted/30 px-5 py-4">
            <AddPresentationForm key={nextCode} productId={product.id} nextCode={nextCode} />
          </div>
        )}
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
      <EmptyState icon={<CalendarRangeIcon />} title="Primero crea una campaña">
        Los precios son de cada campaña.
      </EmptyState>
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResetOnLeave key={`${campaign.id}|${zoneId}`}>
          <form action={PRICES_PATH} className="flex flex-wrap items-center gap-2">
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
        {canEdit && previous && sheet.length > 0 && !copyFrom && (
          <Link
            href={`${PRICES_PATH}?${new URLSearchParams({ campaign: campaign.id, zone: zoneId, copyFrom: previous.id })}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <CopyIcon aria-hidden />
            Copiar precios de {campaignLabel(previous)}
          </Link>
        )}
      </div>
      {zoneId && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <InfoIcon className="size-4 shrink-0" aria-hidden />
          Deja vacío el precio de la zona para usar el general (se muestra en gris).
        </p>
      )}
      {copyFrom && (
        <p className="rounded-xl border border-info/25 bg-info/5 px-4 py-3 text-sm">
          {filled === 0
            ? `${campaignLabel(copyFrom)} no tiene precios para los productos que aquí están vacíos.`
            : `Se completaron ${filled === 1 ? "1 precio" : `${filled} precios`} con los de ${campaignLabel(copyFrom)}. Revísalos y guarda; los que ya tenían precio no cambiaron.`}{" "}
          <Link
            href={`${PRICES_PATH}?${new URLSearchParams({ campaign: campaign.id, zone: zoneId })}`}
            className="font-medium text-primary hover:underline"
          >
            Descartar
          </Link>
        </p>
      )}
      {sheet.length === 0 ? (
        <EmptyState icon={<PackageIcon />} title="Todavía no hay productos." />
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
                <TableCell className="font-medium">{row.product.name}</TableCell>
                <TableCell className="text-muted-foreground">{contentLabel(row.presentation)}</TableCell>
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
