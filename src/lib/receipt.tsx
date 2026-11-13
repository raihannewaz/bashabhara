import fs from "node:fs";
import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSansBengali-Regular.ttf");
export const hasBengali = fs.existsSync(fontPath);
if (hasBengali) {
  Font.register({ family: "Bengali", src: fontPath });
  Font.registerHyphenationCallback((w) => [w]);
}

export type ReceiptData = {
  receiptNo: string; date: string; building: string; flat: string; renter: string; month: string;
  items: { name: string; amount: number }[]; previousDue: number; total: number;
  paid: number; remaining: number; trxId: string; status: "UNPAID" | "PARTIAL" | "PAID";
};

const tk = (n: number) => `Tk ${n.toLocaleString("en-US")}`;
const s = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, textAlign: "center", marginBottom: 2 },
  sub: { textAlign: "center", marginBottom: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  line: { borderBottomWidth: 1, borderBottomColor: "#999", marginVertical: 6 },
  bold: { fontFamily: "Helvetica-Bold" },
  stamp: { position: "absolute", top: 230, right: 40, borderWidth: 3, borderColor: "#15803d", color: "#15803d", padding: 6, fontSize: 22, transform: "rotate(-15deg)", opacity: 0.8 },
  partial: { borderColor: "#b45309", color: "#b45309" },
});

/** English label, followed by the Bengali label in the Bengali font when it is installed. */
const L = ({ en, bn }: { en: string; bn: string }) => (
  <Text>{en}{hasBengali && <Text style={{ fontFamily: "Bengali" }}> / {bn}</Text>}</Text>
);
const Row = ({ en, bn, value, strong }: { en: string; bn: string; value: string; strong?: boolean }) => (
  <View style={s.row}><View><L en={en} bn={bn} /></View><Text style={strong ? s.bold : undefined}>{value}</Text></View>
);

export function receiptDoc(d: ReceiptData) {
  return (
    <Document title={`Receipt ${d.receiptNo}`}>
      <Page size="A5" style={s.page}>
        <Text style={s.title}>MONEY RECEIPT{hasBengali && <Text style={{ fontFamily: "Bengali" }}> / ভাড়ার রশিদ</Text>}</Text>
        <Text style={s.sub}>{d.building}</Text>
        <Row en="Receipt no" bn="রশিদ নং" value={d.receiptNo} />
        <Row en="Date" bn="তারিখ" value={d.date} />
        <Row en="Flat" bn="ফ্ল্যাট" value={d.flat} />
        <Row en="Renter" bn="ভাড়াটিয়া" value={d.renter} />
        <Row en="Month" bn="মাস" value={d.month} />
        <View style={s.line} />
        <View style={s.row}><View><L en="Description" bn="বিবরণ" /></View><View><L en="Amount" bn="টাকা" /></View></View>
        {d.items.map((i, k) => <View key={k} style={s.row}><Text>{i.name}</Text><Text>{tk(i.amount)}</Text></View>)}
        {d.previousDue > 0 && <Row en="Previous due" bn="পূর্বের বকেয়া" value={tk(d.previousDue)} />}
        <View style={s.line} />
        <Row en="Total" bn="মোট" value={tk(d.total)} />
        <Row en="Paid now" bn="এখন পরিশোধিত" value={tk(d.paid)} strong />
        <Row en="Remaining due" bn="অবশিষ্ট বকেয়া" value={tk(d.remaining)} />
        <Row en="Transaction ID" bn="লেনদেন আইডি" value={d.trxId} />
        <View style={s.line} />
        <Text style={{ textAlign: "center" }}>Thank you{hasBengali && <Text style={{ fontFamily: "Bengali" }}> / ধন্যবাদ</Text>}</Text>
        {d.status !== "UNPAID" && (
          <Text style={d.status === "PAID" ? s.stamp : [s.stamp, s.partial]}>
            {d.status === "PAID" ? "PAID" : "PARTIAL"}{hasBengali && <Text style={{ fontFamily: "Bengali" }}> {d.status === "PAID" ? "পরিশোধিত" : "আংশিক"}</Text>}
          </Text>
        )}
      </Page>
    </Document>
  );
}
