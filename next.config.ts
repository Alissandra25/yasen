import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
  // Cache Components (PPR) is off: it conflicts with next-themes' anti-flash <script>
  // (the client-side resume pass re-renders it outside the normal server-HTML-parse path,
  // so the browser never executes it) and forced every plain DB read into a
  // connection()-gated Suspense boundary. Not something stage 0 needs; revisit later
  // if a stage wants the perf trade-off.
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
