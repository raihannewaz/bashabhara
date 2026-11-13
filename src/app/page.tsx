import Link from "next/link";
import { Building2, FileText, MessageCircle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  { icon: Building2, title: "Flats and renters", text: "Buildings, flats, renter records with NID, advance deposit and move-out settlement." },
  { icon: FileText, title: "Dynamic billing", text: "Gas, water, service charge, guard and metered electricity. One click bills every occupied flat." },
  { icon: ShieldCheck, title: "bKash, Nagad and cash", text: "Renters submit a TrxID, you verify it. No payment gateway and no fees." },
  { icon: MessageCircle, title: "WhatsApp and PDF", text: "Send bills and receipts on WhatsApp, and print bilingual Bengali and English receipts." },
];

export default function Landing() {
  return (
    <div>
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">BashaBhara</h1>
        <p className="mt-3 text-lg text-muted-foreground">বাসা ভাড়া ম্যানেজমেন্ট, সহজ ও নির্ভুল</p>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">Rent management for landlords in Bangladesh: bills, collections, receipts and expenses in one place.</p>
        <Link href="/login" style={{ textDecoration: "none", background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }} className="mt-8 inline-block rounded-lg px-6 py-3 font-medium">Log in</Link>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-20 sm:grid-cols-2">
        {features.map((f) => (
          <Card key={f.title}>
            <CardHeader><f.icon className="h-6 w-6 text-primary" /><CardTitle>{f.title}</CardTitle></CardHeader>
            <CardContent className="text-muted-foreground">{f.text}</CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
