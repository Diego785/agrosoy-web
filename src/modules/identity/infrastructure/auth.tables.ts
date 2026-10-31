import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { zones } from "@/modules/customers/infrastructure/customers.tables";
import { id } from "@/shared/infrastructure/db/columns";

// Tables required by Better Auth 1.7 with the username and admin plugins, plus our
// `mustChangePassword` flag. Column names follow Better Auth's field names (docs/decisions.md, D8).

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const users = pgTable("users", {
  id: id(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  // Stored lowercase by the username plugin; `displayUsername` keeps what was typed.
  username: text().unique(),
  displayUsername: text(),
  role: text(),
  /** Deactivated users are "banned" in Better Auth terms: they can't sign in. */
  banned: boolean().default(false),
  banReason: text(),
  banExpires: timestamp({ withTimezone: true }),
  /** Set when an administrator assigns a temporary password; cleared when the user changes it. */
  mustChangePassword: boolean().notNull().default(false),
  // Printed next to the person's signature on documents (D26); Better Auth doesn't read them.
  position: text(),
  documentId: text(),
  workZoneId: uuid().references(() => zones.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    impersonatedBy: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index().on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    /** Password hash for the "credential" provider. */
    password: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index().on(table.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index().on(table.identifier)],
);
