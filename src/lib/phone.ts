import { z } from "zod";
import { isBdMobile, normalizePhone } from "./phone-core";

export { isBdMobile, normalizePhone };
export const phoneSchema = z.string().transform(normalizePhone).refine(isBdMobile, "Enter a valid Bangladeshi mobile number");
