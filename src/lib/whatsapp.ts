const taka = (n: number) => `৳${n.toLocaleString("en-US")}`;

/** Bangladeshi numbers: 01XXXXXXXXX -> https://wa.me/8801XXXXXXXXX */
export function waLink(number: string, text: string) {
  const d = number.replace(/\D/g, "");
  const full = d.startsWith("880") ? d : `88${d.startsWith("0") ? d : "0" + d}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

export function billMessage(o: { name: string; flat: string; month: string; total: number; due: number }) {
  return `প্রিয় ${o.name},\nফ্ল্যাট ${o.flat} — ${o.month} মাসের বিল: ${taka(o.total)}, বকেয়া: ${taka(o.due)}\n\nDear ${o.name}, your bill for ${o.month} (Flat ${o.flat}) is ${taka(o.total)}. Due: ${taka(o.due)}.`;
}

export function receiptMessage(o: { name: string; flat: string; month: string; paid: number; due: number }) {
  return `প্রিয় ${o.name},\n${o.month} মাসের ${taka(o.paid)} পেমেন্ট গ্রহণ করা হয়েছে। অবশিষ্ট বকেয়া: ${taka(o.due)}\n\nPayment of ${taka(o.paid)} received for ${o.month} (Flat ${o.flat}). Remaining due: ${taka(o.due)}. Thank you.`;
}

export function reminderMessage(o: { name: string; flat: string; month: string; due: number; dueDate: string; daysLate: number }) {
  return `প্রিয় ${o.name},\nফ্ল্যাট ${o.flat} — ${o.month} মাসের ${taka(o.due)} বকেয়া আছে (শেষ তারিখ ${o.dueDate}${o.daysLate > 0 ? `, ${o.daysLate} দিন পার হয়েছে` : ""})। অনুগ্রহ করে পরিশোধ করুন।\n\nDear ${o.name}, a payment of ${taka(o.due)} for ${o.month} (Flat ${o.flat}) is pending${o.daysLate > 0 ? `, ${o.daysLate} day(s) past the due date ${o.dueDate}` : `, due on ${o.dueDate}`}. Please pay at your earliest. Thank you.`;
}
