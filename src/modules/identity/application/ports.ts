import type { Role } from "@/shared/domain/role";
import type { NewUserAccount } from "../domain/user-account";

export type UserSummary = {
  id: string;
  name: string;
  username: string;
  /** Null for users without a real email address. */
  email: string | null;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
};

/** User accounts and their credentials. */
export interface UserDirectory {
  /** Throws DomainError "DUPLICATE" with `details.field` ("username" or "email"). */
  create(account: NewUserAccount, temporaryPassword: string): Promise<{ id: string }>;
  list(): Promise<UserSummary[]>;
  findById(userId: string): Promise<UserSummary | undefined>;
  /** Deactivating also ends the user's open sessions. */
  setActive(userId: string, active: boolean): Promise<void>;
  /** Replaces the password, ends open sessions and asks for a change at next sign-in. */
  setTemporaryPassword(userId: string, temporaryPassword: string): Promise<void>;
  clearMustChangePassword(userId: string): Promise<void>;
}

export interface PasswordGenerator {
  generate(): string;
}

/** Checks the current password before changing it, for the signed-in user only. */
export interface OwnCredentials {
  /** Throws DomainError "INVALID_CREDENTIALS" when `currentPassword` is wrong. */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
}
