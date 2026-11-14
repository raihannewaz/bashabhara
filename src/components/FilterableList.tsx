"use client";
import { useState } from "react";
import { Search } from "lucide-react";

export type ListItem = { id: string; search: string; group?: string; node: React.ReactNode };

/** Search box (and optional filter dropdown) over a responsive grid of cards. */
export default function FilterableList({ items, groups, groupLabel = "All", placeholder = "Search", empty = "Nothing here yet.", cols = "sm:grid-cols-2 lg:grid-cols-3" }: {
  items: ListItem[]; groups?: string[]; groupLabel?: string; placeholder?: string; empty?: string; cols?: string;
}) {
  const [q, setQ] = useState("");
  const [g, setG] = useState("");
  const [limit, setLimit] = useState(30);
  const matches = items.filter((i) => (!g || i.group === g) && (!q || i.search.toLowerCase().includes(q.toLowerCase())));
  const shown = matches.slice(0, limit);
  return (
    <div className="space-y-3">
      {items.length > 1 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(30); }} placeholder={placeholder} className="w-full !pl-9" />
          </div>
          {groups && (
            <select value={g} onChange={(e) => { setG(e.target.value); setLimit(30); }} className="sm:w-48">
              <option value="">{groupLabel}</option>
              {groups.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed py-10 text-center text-muted-foreground">{items.length ? "No matches." : empty}</p>
      ) : (
        <div className={`grid gap-3 ${cols}`}>{shown.map((i) => <div key={i.id}>{i.node}</div>)}</div>
      )}
      {matches.length > limit && <button type="button" onClick={() => setLimit(limit + 30)} className="mx-auto block" style={{ background: "transparent", color: "hsl(var(--primary))", border: "1px solid hsl(var(--input))" }}>Show more ({matches.length - limit} left)</button>}
    </div>
  );
}
