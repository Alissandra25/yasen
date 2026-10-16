import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
  // Cache Components (PPR) is off: it conflicts with next-themes' anti-flash <script>
  // (the client-side resume pass re-renders it outside the normal server-HTML-parse path,
  // so the browser never executes it) and forced every plain DB read into a
  // connection()-gated Suspense boundary. Not something stage 0 needs; revisit later
  // if a stage wants the perf trade-off.
  experimental: {
    // Our root layout lives at app/[locale]/layout.tsx — a top-level dynamic segment — so a
    // plain app/not-found.tsx can't compose a page for URLs that don't match any route at all
    // (see node_modules/next/dist/docs/.../not-found.md). global-not-found.js is the documented
    // way to handle that case; app/[locale]/not-found.tsx and (app)/not-found.tsx still handle
    // in-app notFound() calls for matched routes as before.
    globalNotFound: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
