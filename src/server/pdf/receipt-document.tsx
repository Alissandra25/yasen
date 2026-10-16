import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import manropeBase64 from "./fonts/manrope-font-data.json";

// Server-only, same reasoning as stocktake-report.tsx: @react-pdf primitives aren't DOM
// elements, no next-intl here (outside the provider's tree) so every label arrives as a plain
// pre-translated string, and Manrope is registered from base64 (not a filesystem path) because
// Turbopack rewrites __dirname-based paths in a way that doesn't resolve inside a Route Handler.
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
  footerRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#cccccc",
    fontWeight: 700,
  },
  cell: { padding: 4 },
  productCell: { width: "26%" },
  locationCell: { width: "16%" },
  numCell: { width: "11%", textAlign: "right" },
  priceCell: { width: "14%", textAlign: "right" },
  sumCell: { width: "16%", textAlign: "right" },
});

export function ReceiptDocument({
  businessName,
  supplierName,
  postedAt,
  items,
  columnLabels,
  totalLabel,
  totalAmount,
}: {
  businessName: string;
  supplierName: string;
  postedAt: string;
  items: {
    id: number;
    productName: string;
    sku: string | null;
    locationName: string;
    quantity: number;
    purchasePrice: string;
    salePrice: string;
    sum: string;
  }[];
  columnLabels: {
    product: string;
    location: string;
    quantity: string;
    purchasePrice: string;
    salePrice: string;
    sum: string;
  };
  totalLabel: string;
  totalAmount: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{businessName}</Text>
        <Text style={styles.subtitle}>
          {supplierName} · {postedAt}
        </Text>

        <View style={styles.headerRow}>
          <Text style={[styles.cell, styles.productCell]}>
            {columnLabels.product}
          </Text>
          <Text style={[styles.cell, styles.locationCell]}>
            {columnLabels.location}
          </Text>
          <Text style={[styles.cell, styles.numCell]}>
            {columnLabels.quantity}
          </Text>
          <Text style={[styles.cell, styles.priceCell]}>
            {columnLabels.purchasePrice}
          </Text>
          <Text style={[styles.cell, styles.priceCell]}>
            {columnLabels.salePrice}
          </Text>
          <Text style={[styles.cell, styles.sumCell]}>{columnLabels.sum}</Text>
        </View>
        {items.map((item) => (
          <View style={styles.row} key={item.id}>
            <Text style={[styles.cell, styles.productCell]}>
              {item.productName}
              {item.sku ? ` · ${item.sku}` : ""}
            </Text>
            <Text style={[styles.cell, styles.locationCell]}>
              {item.locationName}
            </Text>
            <Text style={[styles.cell, styles.numCell]}>{item.quantity}</Text>
            <Text style={[styles.cell, styles.priceCell]}>
              {item.purchasePrice}
            </Text>
            <Text style={[styles.cell, styles.priceCell]}>
              {item.salePrice}
            </Text>
            <Text style={[styles.cell, styles.sumCell]}>{item.sum}</Text>
          </View>
        ))}
        <View style={styles.footerRow}>
          <Text style={[styles.cell, { width: "69%" }]}>{totalLabel}</Text>
          <Text style={[styles.cell, styles.sumCell]}>{totalAmount}</Text>
        </View>
      </Page>
    </Document>
  );
}
