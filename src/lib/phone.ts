import { z } from "zod";

/** Turns +8801711000001, 8801711000001, 01711-000001 and 1711000001 into 01711000001. */
export function normalizePhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("880")) d = "0" + d.slice(3);
  else if (d.length === 10 && d.startsWith("1")) d = "0" + d;
  return d;
}
export const isBdMobile = (p: string) => /^01[3-9]\d{8}$/.test(p);
export const phoneSchema = z.string().transform(normalizePhone).refine(isBdMobile, "Enter a valid Bangladeshi mobile number");
