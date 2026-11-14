import { Document, Page, Text, View } from "@react-pdf/renderer";
import { L, Row, hasBengali, s, tk } from "./receipt";

export type BillData = {
  building: string; flat: string; renter: string; month: string; dueDate: string;
  items: { name: string; amount: number }[]; previousDue: number; total: number; paid: number; due: number; accounts: string[];
};

export function billDoc(d: BillData) {
  return (
    <Document title={`Bill ${d.month} flat ${d.flat}`}>
      <Page size="A5" style={s.page}>
        <Text style={s.title}>RENT BILL{hasBengali && <Text style={{ fontFamily: "Bengali" }}> / ভাড়ার বিল</Text>}</Text>
        <Text style={s.sub}>{d.building}</Text>
        <Row en="Flat" bn="ফ্ল্যাট" value={d.flat} />
        <Row en="Renter" bn="ভাড়াটিয়া" value={d.renter} />
        <Row en="Month" bn="মাস" value={d.month} />
        <Row en="Due date" bn="শেষ তারিখ" value={d.dueDate} />
        <View style={s.line} />
        <View style={s.row}><View><L en="Description" bn="বিবরণ" /></View><View><L en="Amount" bn="টাকা" /></View></View>
        {d.items.map((i, k) => <View key={k} style={s.row}><Text>{i.name}</Text><Text>{tk(i.amount)}</Text></View>)}
        {d.previousDue > 0 && <Row en="Previous due" bn="পূর্বের বকেয়া" value={tk(d.previousDue)} />}
        <View style={s.line} />
        <Row en="Total" bn="মোট" value={tk(d.total)} />
        <Row en="Paid" bn="পরিশোধিত" value={tk(d.paid)} />
        <Row en="Amount due" bn="বকেয়া" value={tk(d.due)} strong />
        {d.accounts.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <L en="Pay to" bn="টাকা পাঠান" />
            {d.accounts.map((a, k) => <Text key={k}>{a}</Text>)}
          </View>
        )}
      </Page>
    </Document>
  );
}
