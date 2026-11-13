"use client";
import { useEffect } from "react";
import { toast } from "sonner";

/** Shows the ?ok / ?error result of a form action as a toast. */
export default function Flash({ ok, error }: { ok?: string; error?: string }) {
  useEffect(() => {
    if (error) toast.error(error, { id: error });
    else if (ok) toast.success("Saved", { id: "saved" });
  }, [ok, error]);
  return null;
}
