import { reversalsOf, type LedgerPosting, type LedgerSource } from "../domain/ledger";
import type { LedgerRepository } from "./ledger-ports";

// How other modules write debt. Their use cases check the actor's permissions and run in the same
// transaction, so the document and its entries are saved together or not at all (principle 3).

export async function postToLedger(
  ledger: LedgerRepository,
  postings: readonly LedgerPosting[],
  actorId: string,
): Promise<void> {
  if (postings.length > 0) await ledger.append(postings, actorId);
}

/** Cancels everything a document posted, dated the day of the void. */
export async function reverseInLedger(
  ledger: LedgerRepository,
  source: LedgerSource,
  date: string,
  actorId: string,
): Promise<void> {
  await postToLedger(ledger, reversalsOf(await ledger.entriesOf(source), date), actorId);
}
