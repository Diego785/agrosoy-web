import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser client for sign-in and sign-out. They go through /api/auth so Better Auth's rate
 * limiting applies to password attempts; everything else uses server actions.
 */
export const authClient = createAuthClient({ plugins: [usernameClient()] });
