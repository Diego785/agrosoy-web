import { notFound } from "next/navigation";
import { campaignOn } from "@/modules/campaigns/domain/campaign";
import { contentLabel } from "@/modules/catalog/presentation/catalog-labels";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { trimDecimalZeros } from "@/shared/presentation/format";
import { notFoundAsNull } from "@/shared/presentation/not-found";
import { followUpOptions } from "../application/note-follow-ups";
import { FollowUpForm } from "./follow-up-form";
import { noteDeps } from "./note-deps";
import { loadNoteFormOptions } from "./note-form-options";

/** The return or transfer form for a confirmed delivery note; 404 for anything else. */
export async function FollowUpPage({
  params,
  mode,
}: {
  params: Promise<{ id: string }>;
  mode: "return" | "transfer";
}) {
  const { id } = await params;
  const actor = await requireActor();
  const options = await followUpOptions(noteDeps(getDb()), actor, id).catch((error: unknown) => {
    // Only confirmed delivery notes take returns and transfers.
    if (isDomainError(error) && error.code === "INVALID_STATE") return null;
    return notFoundAsNull(error);
  });
  if (!options) notFound();
  const { note, remaining } = options;
  const today = todayInBolivia();

  // A transfer suggests the new campaign's reference price for the customer's zone.
  let suggested: Record<string, string> = {};
  let exchangeRate = note.exchangeRate ? trimDecimalZeros(note.exchangeRate) : "";
  if (mode === "transfer") {
    const formOptions = await loadNoteFormOptions(actor);
    const customer = formOptions.customers.find((option) => option.id === note.customer.id);
    const campaign = campaignOn(formOptions.campaigns, today);
    const byZone = campaign ? (formOptions.prices[campaign.id] ?? {}) : {};
    suggested = { ...byZone[""], ...byZone[customer?.zoneId ?? ""] };
    const rate = customer?.fixedExchangeRate ?? formOptions.currentRate;
    if (rate) exchangeRate = trimDecimalZeros(rate);
  }

  return (
    <FollowUpForm
      mode={mode}
      noteId={note.id}
      today={today}
      defaults={{ receiverName: note.receiver.name, exchangeRate }}
      lines={note.lines.map((line) => ({
        id: line.id,
        label: `${line.productName} · ${contentLabel(line)}${line.freeOfCharge ? " (sin cargo)" : ""}`,
        delivered: line.quantity,
        remaining: remaining[line.id] ?? "0",
        unitPrice: line.unitPrice,
        isFree: line.freeOfCharge !== null,
        suggestedPrice: suggested[line.presentationId] ?? "",
      }))}
    />
  );
}
