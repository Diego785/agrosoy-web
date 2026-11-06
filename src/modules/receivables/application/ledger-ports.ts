import type { Money } from "@/shared/domain/money";
import type { LedgerEntry, LedgerPosting, LedgerSource } from "../domain/ledger";

/** The customer ledger (M7). Append-only: the database rejects updates and deletes (D6). */
export interface LedgerRepository {
  append(postings: readonly LedgerPosting[], createdBy: string): Promise<void>;
  entriesOf(source: LedgerSource): Promise<LedgerEntry[]>;
  /** What the customer owes right now across every campaign. */
  customerBalance(customerId: string): Promise<Money>;
}
