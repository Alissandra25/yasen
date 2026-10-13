---
paths:
  - "src/app/**"
  - "src/components/**"
---

# UI rules

- Build on shadcn/ui components. Don't hand-edit `src/components/ui/`; wrap or compose instead.
- No literal user-facing strings: `useTranslations` / `getTranslations` from next-intl, keys added to `messages/en.json`, `uk.json` and `ru.json`.
- Colours only via theme tokens (`bg-primary`, `text-destructive`, …). No hex values or Tailwind arbitrary colours (`bg-[#...]`).
- Brand tokens (primary / accent) come from business settings. Semantic states never use the brand:
  error and critical signals (negative stock, discrepancies) use the destructive red; success messages are neutral or icon-based.
- Text on a brand fill uses the automatically chosen foreground (black or white by contrast). Brand-coloured text on light backgrounds uses the darker derived shade.
- Accessibility: real `<button>`, `<a>`, `<label>` + inputs; `aria-label` on icon-only buttons; visible focus.
- Money is displayed only through `formatMoney` from `src/lib/money.ts`; dates only through `src/lib/dates.ts` formatters.
- Data fetching on the client: TanStack Query. No Redux.
- Every page must work in light and dark themes.
- Never sum quantities of different products (no "48 pcs" totals across rows, footers or headers). Cross-product totals show the number of lines/products and money only. Some mockups still show such totals — do not implement them.
- Quantities are displayed and parsed only through `src/lib/quantity.ts`, with the unit label; prices for non-piece units are labelled per unit ("грн/м").
- Hints, validation and error states follow spec section 13.7 (red = errors only, amber = warnings/business rules/offline; error summary after submit; never colour alone).
