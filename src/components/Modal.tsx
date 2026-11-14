"use client";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Button that opens a dialog. The dialog closes itself when a form inside it is submitted. */
export default function Modal({ trigger, title, children, variant = "outline", small = true }: {
  trigger: React.ReactNode; title: string; children: React.ReactNode; variant?: "default" | "outline" | "ghost" | "destructive"; small?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false); // the form is only mounted after the first open, which keeps long lists light
  return (
    <>
      <Button type="button" variant={variant} className={small ? "px-3 py-1.5" : ""} onClick={() => { setOpened(true); ref.current?.showModal(); }}>{trigger}</Button>
      <dialog
        ref={ref}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
        onSubmit={() => setTimeout(() => ref.current?.close(), 50)}
        className="m-auto max-h-[90vh] w-[min(94vw,30rem)] overflow-y-auto rounded-xl border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/50"
      >
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="!mb-0">{title}</h2>
            <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="!bg-transparent !p-1 !text-foreground"><X className="h-5 w-5" /></button>
          </div>
          {opened && children}
        </div>
      </dialog>
    </>
  );
}
