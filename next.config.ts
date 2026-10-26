import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Self-contained server bundle for the Docker image (docs/decisions.md, D14).
  output: "standalone",
  // Development logs print server action arguments, which include passwords.
  logging: { serverFunctions: false },
  // Spreadsheet uploads go through a server action; the use case allows up to 5 MB.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
