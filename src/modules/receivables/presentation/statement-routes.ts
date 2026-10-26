export const STATEMENTS_PATH = "/statements";

export function statementPath(sourceId: string): string {
  return `${STATEMENTS_PATH}/${sourceId}`;
}

export function customerStatementPath(sourceId: string, customerKey: string): string {
  return `${statementPath(sourceId)}/${encodeURIComponent(customerKey)}`;
}
