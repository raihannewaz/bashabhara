export const FREE_FLAT_LIMIT = 5;
export const PRO_PRICE = 500; // taka per payment, shown to landlords when they upgrade
export const SAAS_PAYMENT_INFO = process.env.SAAS_PAYMENT_INFO ?? "Ask the administrator for the payment number";

/** Flat limit for a landlord: the administrator's custom limit wins, then the plan's limit. */
export const getFlatLimit = (o: { plan: string; flatLimit: number | null }) => o.flatLimit ?? (o.plan === "PRO" ? Infinity : FREE_FLAT_LIMIT);
