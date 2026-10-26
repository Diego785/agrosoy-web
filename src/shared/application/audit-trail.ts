export type AuditEntry = {
  actorId: string;
  /** "<module>.<command>", for example "customers.register". */
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
};

/** Port every use case uses to record who changed what (docs/domain-model.md, principle 6). */
export interface AuditTrail {
  record(entry: AuditEntry): Promise<void>;
}
