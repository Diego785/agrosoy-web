import { sql, type AnyColumn, type SQL } from "drizzle-orm";

/**
 * A text column compared the way `normalizeForComparison` compares names: lower case and without the
 * accents Spanish uses, the ñ kept. For columns that have no stored comparison key (a locality, a
 * user's name), so a search for "yapacani" finds "Yapacaní".
 */
export function comparableText(column: AnyColumn): SQL {
  return sql`translate(lower(${column}), 'áéíóúüàèìòùâêîôû', 'aeiouuaeiouaeiou')`;
}
