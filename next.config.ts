import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Runtime repository data is not application source or a deployment dependency.
  outputFileTracingExcludes: { "/*": ["./.cache/**/*"] },
  cacheComponents: true,
  partialPrefetching: true,
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
