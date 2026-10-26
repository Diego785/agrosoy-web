/**
 * Gapless numbering for one kind of document (delivery notes, receipts). Numbers continue the
 * paper pads, and paper documents typed in later keep their printed number, so the counter skips
 * numbers that are already taken.
 */
export interface DocumentCounter {
  /** Takes the next free number; concurrent callers wait for each other until their transaction ends. */
  take(isTaken: (number: number) => Promise<boolean>): Promise<number>;
  /** The number `take` would return now. */
  peek(isTaken: (number: number) => Promise<boolean>): Promise<number>;
  /** Where numbering continues, for example the first page of a new paper pad. */
  set(next: number): Promise<void>;
}
