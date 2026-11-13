"use client";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import NavLinks from "@/components/NavLinks";

export default function MobileBar({ links, children }: { links: { href: string; label: string; icon: string }[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-40 border-b bg-card md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-lg font-bold">BashaBhara</span>
        <button type="button" aria-label="Menu" onClick={() => setOpen(!open)} className="!bg-transparent !p-1 !text-foreground">{open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
      </div>
      {open && <div className="space-y-2 border-t p-3"><NavLinks links={links} onNavigate={() => setOpen(false)} />{children}</div>}
    </div>
  );
}
