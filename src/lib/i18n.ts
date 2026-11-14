import { cookies } from "next/headers";

const en = {
  "nav.overview": "Overview", "nav.setup": "Setup", "nav.readings": "Meter & bills", "nav.invoices": "Invoices", "nav.payments": "Payments",
  "nav.overdue": "Overdue", "nav.requests": "Repair requests", "nav.notices": "Notices", "nav.expenses": "Expenses", "nav.reports": "Reports",
  "nav.audit": "Activity log", "nav.staff": "Staff", "nav.plan": "Plan", "nav.account": "Account", "nav.logout": "Log out",
  "status.PAID": "Paid", "status.PARTIAL": "Partial", "status.UNPAID": "Unpaid", "status.PENDING": "Pending", "status.APPROVED": "Approved",
  "status.REJECTED": "Rejected", "status.OPEN": "Open", "status.IN_PROGRESS": "In progress", "status.DONE": "Done",
  "login.title": "Log in to BashaBhara", "login.id": "Email or phone", "login.password": "Password", "login.submit": "Log in",
  "login.wrong": "Wrong email, phone or password, or the account is locked for 15 minutes after 5 failed attempts.",
  "login.forgot": "Forgot your password? Renters and staff: ask your landlord to reset it. Landlords: ask the administrator.",
  "ov.title": "Overview", "ov.flats": "Flats", "ov.occupied": "Occupied", "ov.vacant": "Vacant", "ov.toVerify": "Payments to verify", "ov.outstanding": "Outstanding",
  "ov.overdue": "Overdue", "ov.collection": "Collected this month", "ov.income": "Income and expenses, last 6 months", "ov.leases": "Leases ending within 60 days",
  "p.hello": "Hello", "p.balance": "Current balance due", "p.sendTo": "Send your payment to", "p.noAccounts": "Your landlord has not added a payment account yet.",
  "p.bills": "Bills", "p.noBills": "No bills yet.", "p.total": "Total", "p.paid": "Paid", "p.due": "Due", "p.prevDue": "Previous due", "p.pay": "Pay this bill",
  "p.payHelp": "First send the money with bKash, Nagad or bank transfer, then enter the TrxID here.", "p.amount": "Amount you sent (৳)",
  "p.amountHint": "You can pay part of the bill, or more to keep the rest as advance credit", "p.trx": "TrxID", "p.sender": "Number you sent from",
  "p.shot": "Screenshot (optional)", "p.submit": "Submit payment", "p.receipt": "Receipt", "p.billPdf": "Download bill", "p.credit": "Advance credit",
  "p.notices": "Notices", "p.report": "Report a problem", "p.reportTitle": "What is the problem?", "p.reportDetails": "Details (optional)",
  "p.requests": "My requests", "p.lease": "Your lease ends on", "p.dueOn": "Due on", "p.send": "Send", "p.noRequests": "You have not reported anything.",
} as const;

export type Key = keyof typeof en;

const bn: Record<Key, string> = {
  "nav.overview": "ওভারভিউ", "nav.setup": "সেটআপ", "nav.readings": "মিটার ও বিল", "nav.invoices": "ইনভয়েস", "nav.payments": "পেমেন্ট",
  "nav.overdue": "বকেয়া তালিকা", "nav.requests": "মেরামতের অনুরোধ", "nav.notices": "নোটিশ", "nav.expenses": "খরচ", "nav.reports": "রিপোর্ট",
  "nav.audit": "কার্যকলাপ লগ", "nav.staff": "কর্মী", "nav.plan": "প্ল্যান", "nav.account": "অ্যাকাউন্ট", "nav.logout": "লগ আউট",
  "status.PAID": "পরিশোধিত", "status.PARTIAL": "আংশিক", "status.UNPAID": "অপরিশোধিত", "status.PENDING": "অপেক্ষমান", "status.APPROVED": "অনুমোদিত",
  "status.REJECTED": "বাতিল", "status.OPEN": "খোলা", "status.IN_PROGRESS": "চলমান", "status.DONE": "সম্পন্ন",
  "login.title": "বাসাভাড়া-তে লগ ইন করুন", "login.id": "ইমেইল বা ফোন", "login.password": "পাসওয়ার্ড", "login.submit": "লগ ইন",
  "login.wrong": "ইমেইল, ফোন বা পাসওয়ার্ড ভুল, অথবা ৫ বার ভুলের পর অ্যাকাউন্ট ১৫ মিনিটের জন্য বন্ধ আছে।",
  "login.forgot": "পাসওয়ার্ড ভুলে গেছেন? ভাড়াটিয়া ও কর্মীরা বাড়িওয়ালাকে বলুন, বাড়িওয়ালারা অ্যাডমিনকে বলুন।",
  "ov.title": "ওভারভিউ", "ov.flats": "ফ্ল্যাট", "ov.occupied": "ভাড়া দেওয়া", "ov.vacant": "খালি", "ov.toVerify": "যাচাইয়ের অপেক্ষায়", "ov.outstanding": "মোট বকেয়া",
  "ov.overdue": "মেয়াদোত্তীর্ণ বকেয়া", "ov.collection": "এই মাসে আদায়", "ov.income": "গত ৬ মাসের আয় ও খরচ", "ov.leases": "৬০ দিনের মধ্যে শেষ হবে এমন চুক্তি",
  "p.hello": "স্বাগতম", "p.balance": "বর্তমান বকেয়া", "p.sendTo": "টাকা পাঠানোর মাধ্যম", "p.noAccounts": "বাড়িওয়ালা এখনও কোনো পেমেন্ট অ্যাকাউন্ট যোগ করেননি।",
  "p.bills": "বিলসমূহ", "p.noBills": "এখনও কোনো বিল নেই।", "p.total": "মোট", "p.paid": "পরিশোধিত", "p.due": "বকেয়া", "p.prevDue": "পূর্বের বকেয়া", "p.pay": "বিল পরিশোধ করুন",
  "p.payHelp": "আগে বিকাশ, নগদ বা ব্যাংকের মাধ্যমে টাকা পাঠান, তারপর এখানে TrxID দিন।", "p.amount": "পাঠানো টাকার পরিমাণ (৳)",
  "p.amountHint": "আংশিক অথবা বেশি পরিশোধ করতে পারেন; বাড়তি টাকা অগ্রিম জমা থাকবে", "p.trx": "TrxID", "p.sender": "যে নম্বর থেকে পাঠিয়েছেন",
  "p.shot": "স্ক্রিনশট (ঐচ্ছিক)", "p.submit": "পেমেন্ট জমা দিন", "p.receipt": "রশিদ", "p.billPdf": "বিল ডাউনলোড", "p.credit": "অগ্রিম জমা",
  "p.notices": "নোটিশ", "p.report": "সমস্যা জানান", "p.reportTitle": "সমস্যাটি কী?", "p.reportDetails": "বিস্তারিত (ঐচ্ছিক)",
  "p.requests": "আমার অনুরোধ", "p.lease": "আপনার চুক্তির মেয়াদ শেষ হবে", "p.dueOn": "শেষ তারিখ", "p.send": "পাঠান", "p.noRequests": "আপনি এখনও কিছু জানাননি।",
};

export async function getLang(): Promise<"en" | "bn"> {
  return (await cookies()).get("lang")?.value === "bn" ? "bn" : "en";
}

/** Returns a translate function for the visitor's chosen language. */
export async function getT() {
  const lang = await getLang();
  const d: Record<Key, string> = lang === "bn" ? bn : en;
  return { lang, t: (k: Key) => d[k] };
}
