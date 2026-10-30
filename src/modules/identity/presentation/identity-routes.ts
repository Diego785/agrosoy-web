export const HOME_PATH = "/";
export const LOGIN_PATH = "/login";
export const USERS_PATH = "/users";
export const NEW_USER_PATH = "/users/new";

export function editUserPath(userId: string): string {
  return `${USERS_PATH}/${userId}`;
}
export const CHANGE_PASSWORD_PATH = "/account/password";
export const PERMISSIONS_PATH = "/users/permissions";
export const AUDIT_PATH = "/audit";
