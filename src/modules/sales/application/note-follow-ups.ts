import { z } from "zod";
import { postToLedger } from "@/modules/receivables/application/ledger-service";
import { posting, type LedgerPosting } from "@/modules/receivables/domain/ledger";
import type { Actor } from "@/shared/application/actor";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError, isDomainError } from "@/shared/domain/domain-error";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import { optionalText } from "@/shared/domain/text";
import {
  remaining,
  returnLines,
  shared,
  transferLines,
  type FollowUpLine,
  type FollowUpNote,
} from "../domain/follow-up";
import type { NoteLifecycleDeps } from "./note-lifecycle";
import type { ConsignedLine, FollowUpItem, NoteLookups } from "./note-ports";
import { followUpTargetSchema, returnSchema, transferSchema } from "./note-schemas";

type FollowUpDeps = Omit<NoteLifecycleDeps, "payments" | "receipts" | "today" | "lookups"> & {
  lookups: Pick<NoteLookups, "campaignOn" | "customer">;
};
type Source = ConsignedLine["source"];

/** The domain's reasons, as the form shows them next to each quantity. */
const LINE_MESSAGES: Record<string, string> = {
  not_consigned: "Esa línea no es de lo que el cliente recibió en la campaña.",
  exceeds_remaining: "Es más de lo que queda de esta línea.",
  no_lines: "Indica la cantidad de al menos un producto.",
  free_not_transferable: "Las bonificaciones y muestras no se pasan de campaña.",
};

/** The returns and transfers that took product from a note, for its page. */
export async function listFollowUps(
  deps: Pick<FollowUpDeps, "notes">,
  actor: Actor,
  noteId: unknown,
): Promise<FollowUpItem[]> {
  assertCan(actor, "notes.view");
  return deps.notes.followUps(validateInput(z.uuid(), noteId));
}

/**
 * What a customer still holds from a campaign, line by line and from every delivery or transfer
 * into it, for the return and transfer forms (D25). Lines already settled are left out.
 */
export async function followUpOptions(
  deps: Pick<FollowUpDeps, "notes">,
  actor: Actor,
  input: unknown,
): Promise<ConsignedLine[]> {
  assertCan(actor, "notes.manage");
  const { customerId, campaignId } = validateInput(followUpTargetSchema, input);
  const lines = await deps.notes.consignedLines(customerId, campaignId);
  return lines.filter((line) => remaining(line).isPositive());
}

/**
 * Product a customer brings back, from any of the deliveries they received in the campaign (D25):
 * each line credited at the price it was delivered for, in that campaign, on the day of the return.
 * Stock comes back once inventory exists.
 */
export async function registerReturn(
  deps: FollowUpDeps,
  actor: Actor,
  input: unknown,
): Promise<{ id: string; number: number }> {
  assertCan(actor, "notes.manage");
  const data = validateInput(returnSchema, input);
  const customer = await existingCustomer(deps, data.customerId);
  await openCampaignOn(deps, data.noteDate);
  const consigned = await deps.notes.consignedLines(data.customerId, data.campaignId);
  const lines = linesOrFieldErrors(() =>
    returnLines(
      consigned,
      data.lines.map((line) => ({
        originalLineId: line.originalLineId,
        quantity: Quantity.parse(line.quantity),
      })),
    ),
  );
  const sources = sourcesOf(consigned, lines);
  assertAfterSources(sources, data.noteDate);
  // The rate and terms of the deliveries when they agree; mixed ones leave the rate to the payment.
  const rate = shared(sources.map((source) => source.exchangeRate));
  const allCash = sources.every((source) => source.paymentTerms === "cash");

  return saveFollowUp(deps, actor, data.paperNumber, sources, {
    note: {
      ...followUpHeader(data, sources, customer),
      type: "return",
      campaignId: data.campaignId,
      paymentTerms: allCash && rate ? "cash" : "credit",
      exchangeRate: rate ? ExchangeRate.parse(rate) : null,
      receiver: { name: data.receiverName, documentId: null, relationship: null },
      lines,
    },
    postings: (id) => {
      const credit = sumOf(lines, "total");
      return credit.isPositive()
        ? [ledgerLine(data.customerId, data.campaignId, data.noteDate, "return", credit, id)]
        : [];
    },
  });
}

/**
 * Product the customer still holds from a campaign moves to the campaign of the transfer date,
 * from any of the deliveries they received (D25): credited at its old price in the old campaign,
 * charged at the new price in the new one (domain model, M5).
 */
export async function registerTransfer(
  deps: FollowUpDeps,
  actor: Actor,
  input: unknown,
): Promise<{ id: string; number: number }> {
  assertCan(actor, "notes.manage");
  const data = validateInput(transferSchema, input);
  const customer = await existingCustomer(deps, data.customerId);
  const campaign = await openCampaignOn(deps, data.noteDate);
  if (campaign.id === data.campaignId) {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: {
        noteDate: ["La fecha cae en la misma campaña del producto; elige una fecha de la nueva campaña."],
      },
    });
  }
  const consigned = await deps.notes.consignedLines(data.customerId, data.campaignId);
  const lines = linesOrFieldErrors(() =>
    transferLines(
      consigned,
      data.lines.map((line) => ({
        originalLineId: line.originalLineId,
        quantity: Quantity.parse(line.quantity),
        unitPrice: Money.parse(line.unitPrice),
      })),
    ),
  );
  const sources = sourcesOf(consigned, lines);
  assertAfterSources(sources, data.noteDate);

  return saveFollowUp(deps, actor, data.paperNumber, sources, {
    note: {
      ...followUpHeader(data, sources, customer),
      type: "campaign_transfer",
      campaignId: campaign.id,
      paymentTerms: "credit",
      exchangeRate: ExchangeRate.parse(data.exchangeRate),
      receiver: { name: customer.name, documentId: null, relationship: null },
      lines,
    },
    postings: (id) => [
      ledgerLine(
        data.customerId,
        data.campaignId,
        data.noteDate,
        "campaign_transfer_out",
        sumOf(lines, "originalTotal"),
        id,
      ),
      ledgerLine(
        data.customerId,
        campaign.id,
        data.noteDate,
        "campaign_transfer_in",
        sumOf(lines, "total"),
        id,
      ),
    ],
  });
}

async function saveFollowUp(
  deps: FollowUpDeps,
  actor: Actor,
  paperNumber: number | "",
  sources: readonly Source[],
  document: { note: FollowUpNote; postings: (id: string) => LedgerPosting[] },
): Promise<{ id: string; number: number }> {
  const { note } = document;
  if (paperNumber && (await deps.notes.numberInUse(paperNumber))) {
    throw new DomainError("DUPLICATE", { field: "paperNumber" });
  }
  const number = paperNumber || (await deps.numbering.take((candidate) => deps.notes.numberInUse(candidate)));
  const { id } = await deps.notes.insertFollowUp(note, number, actor.id);
  await postToLedger(deps.ledger, document.postings(id), actor.id);
  await deps.audit.record({
    actorId: actor.id,
    action: note.type === "return" ? "sales.register_return" : "sales.register_transfer",
    entityType: "delivery_note",
    entityId: id,
    payload: { number, sourceNoteIds: sources.map((source) => source.id), lines: note.lines.length },
  });
  return { id, number };
}

type Customer = NonNullable<Awaited<ReturnType<FollowUpDeps["lookups"]["customer"]>>>;

/** An inactive customer can still give back what they hold. */
async function existingCustomer(deps: Pick<FollowUpDeps, "lookups">, customerId: string): Promise<Customer> {
  const customer = await deps.lookups.customer(customerId);
  if (!customer) {
    throw new DomainError("VALIDATION_FAILED", { fieldErrors: { customerId: ["Elige el cliente."] } });
  }
  return customer;
}

function followUpHeader(
  data: { customerId: string; noteDate: string; observations?: string },
  sources: readonly Source[],
  customer: Customer,
): Omit<FollowUpNote, "type" | "campaignId" | "paymentTerms" | "exchangeRate" | "receiver" | "lines"> {
  return {
    noteDate: data.noteDate,
    customerId: data.customerId,
    propertyId: shared(sources.map((source) => source.propertyId)),
    // The deliveries' technician when they agree; otherwise whoever looks after the customer now.
    technicianId: shared(sources.map((source) => source.technicianId)) ?? customer.technicianId,
    // Who receives a return for Agrosoil and the carrier aren't asked yet; the form adds them later.
    handedOverById: null,
    carrier: { name: null, vehicle: null, documentId: null },
    observations: optionalText(data.observations) ?? null,
  };
}

/** The notes the chosen lines come from, oldest first, each once. */
function sourcesOf(consigned: readonly ConsignedLine[], lines: readonly FollowUpLine[]): Source[] {
  const sourceOfLine = new Map(consigned.map((line) => [line.id, line.source]));
  const byId = new Map<string, Source>();
  for (const line of lines) {
    const source = sourceOfLine.get(line.originalLineId);
    if (source) byId.set(source.id, source);
  }
  return [...byId.values()].toSorted((a, b) => a.noteDate.localeCompare(b.noteDate));
}

/** "N.º 1250", or "N.º 45 (planilla)" for one brought from a spreadsheet. */
export function sourceLabel(source: Pick<Source, "number" | "imported" | "sheetNumber">): string {
  return source.imported ? `N.º ${source.sheetNumber ?? "—"} (planilla)` : `N.º ${source.number ?? "—"}`;
}

/** Nothing comes back, or moves, before it was delivered. */
function assertAfterSources(sources: readonly Source[], isoDate: string): void {
  const latest = sources.at(-1);
  if (latest && isoDate < latest.noteDate) {
    const day = latest.noteDate.split("-").toReversed().join("/");
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: { noteDate: [`La fecha es anterior a la boleta ${sourceLabel(latest)} del ${day}.`] },
    });
  }
}

function ledgerLine(
  customerId: string,
  campaignId: string,
  date: string,
  kind: "return" | "campaign_transfer_out" | "campaign_transfer_in",
  amount: Money,
  noteId: string,
): LedgerPosting {
  return posting({
    customerId,
    campaignId,
    date,
    kind,
    amount,
    source: { type: "delivery_note", id: noteId },
  });
}

function sumOf(lines: readonly FollowUpLine[], field: "total" | "originalTotal"): Money {
  return Money.sum(lines.map((line) => line[field]));
}

/** Returns and transfers are new documents: their date must fall in an open campaign. */
async function openCampaignOn(deps: Pick<FollowUpDeps, "lookups">, isoDate: string): Promise<{ id: string }> {
  const campaign = await deps.lookups.campaignOn(isoDate);
  const message = !campaign
    ? "La fecha no cae en ninguna campaña."
    : campaign.status === "closed"
      ? "La campaña de esa fecha ya está cerrada."
      : null;
  if (message || !campaign) {
    throw new DomainError("VALIDATION_FAILED", { fieldErrors: { noteDate: [message ?? ""] } });
  }
  return campaign;
}

/** Turns the domain's line codes into the messages shown next to each quantity. */
function linesOrFieldErrors(build: () => FollowUpLine[]): FollowUpLine[] {
  try {
    return build();
  } catch (error) {
    if (isDomainError(error) && error.code === "VALIDATION_FAILED") {
      const fieldErrors = (error.details.fieldErrors ?? {}) as Record<string, string[]>;
      throw new DomainError("VALIDATION_FAILED", {
        fieldErrors: Object.fromEntries(
          Object.entries(fieldErrors).map(([field, codes]) => [
            field === "lines" ? "root" : field,
            codes.map((code) => LINE_MESSAGES[code] ?? code),
          ]),
        ),
      });
    }
    throw error;
  }
}
