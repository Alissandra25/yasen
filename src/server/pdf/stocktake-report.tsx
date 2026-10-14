import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import manropeBase64 from "./fonts/manrope-font-data.json";
import type { StocktakeItemRow } from "@/server/services/stocktakes";

// Server-only (rendered inside a Route Handler, never imported by client code): @react-pdf's
// Document/Page/View/Text are PDF primitives, not DOM elements — bundling them for the browser
// would be a mistake, not just dead weight. No next-intl here either (outside the React tree
// that provider wraps), so every label comes in as a plain pre-translated string prop.
//
// Helvetica (react-pdf's default) has no Cyrillic glyphs, and product/business names are
// routinely Ukrainian or Russian — Manrope (the app's own UI typeface, spec 13.5) covers
// Cyrillic. Registered from a base64 data URL, not a filesystem path: Next's bundler (Turbopack,
// this version) rewrites `__dirname`/`process.cwd()`-based paths to a placeholder that doesn't
// resolve at request time in a Route Handler, but a plain JSON import goes through the normal
// module graph and isn't affected.
Font.register({
  family: "Manrope",
  fonts: [
    { src: `data:font/ttf;base64,${manropeBase64.regular}`, fontWeight: 400 },
    { src: `data:font/ttf;base64,${manropeBase64.bold}`, fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Manrope" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#555555", marginBottom: 16 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#f3f3f0",
    fontWeight: 700,
  },
  cell: { padding: 4 },
  productCell: { width: "34%" },
  skuCell: { width: "14%" },
  numCell: { width: "13%", textAlign: "right" },
  reasonCell: { width: "26%" },
  summary: { marginTop: 16, fontSize: 10, fontWeight: 700 },
});

export function StocktakeReportDocument({
  businessName,
  locationName,
  generatedAt,
  items,
  reasonLabels,
  columnLabels,
  summaryLabel,
}: {
  businessName: string;
  locationName: string;
  generatedAt: string;
  items: StocktakeItemRow[];
  reasonLabels: Record<string, string>;
  columnLabels: {
    product: string;
    sku: string;
    system: string;
    counted: string;
    difference: string;
    reason: string;
  };
  summaryLabel: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{businessName}</Text>
        <Text style={styles.subtitle}>
          {locationName} · {generatedAt}
        </Text>

        <View style={styles.headerRow}>
          <Text style={[styles.cell, styles.productCell]}>
            {columnLabels.product}
          </Text>
          <Text style={[styles.cell, styles.skuCell]}>{columnLabels.sku}</Text>
          <Text style={[styles.cell, styles.numCell]}>
            {columnLabels.system}
          </Text>
          <Text style={[styles.cell, styles.numCell]}>
            {columnLabels.counted}
          </Text>
          <Text style={[styles.cell, styles.numCell]}>
            {columnLabels.difference}
          </Text>
          <Text style={[styles.cell, styles.reasonCell]}>
            {columnLabels.reason}
          </Text>
        </View>
        {items.map((item) => {
          const diff =
            item.countedQuantity !== null
              ? item.countedQuantity - item.systemQuantity
              : null;
          return (
            <View style={styles.row} key={item.id}>
              <Text style={[styles.cell, styles.productCell]}>
                {item.productName}
              </Text>
              <Text style={[styles.cell, styles.skuCell]}>
                {item.sku ?? ""}
              </Text>
              <Text style={[styles.cell, styles.numCell]}>
                {item.systemQuantity}
              </Text>
              <Text style={[styles.cell, styles.numCell]}>
                {item.countedQuantity ?? "—"}
              </Text>
              <Text style={[styles.cell, styles.numCell]}>
                {diff !== null ? (diff > 0 ? `+${diff}` : diff) : ""}
              </Text>
              <Text style={[styles.cell, styles.reasonCell]}>
                {item.reason ? reasonLabels[item.reason] : ""}
              </Text>
            </View>
          );
        })}

        <Text style={styles.summary}>{summaryLabel}</Text>
      </Page>
    </Document>
  );
}
