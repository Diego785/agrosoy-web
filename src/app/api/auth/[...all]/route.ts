import { getAuth } from "@/modules/identity/infrastructure/auth";

// Better Auth's HTTP endpoints (sign-in, sign-out, session). Resolved per request so
// `next build` doesn't need the database or the auth secret.
export function GET(request: Request) {
  return getAuth().handler(request);
}

export function POST(request: Request) {
  return getAuth().handler(request);
}
