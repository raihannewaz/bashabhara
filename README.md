# BashaBhara SaaS (starter)

Landlord dashboard with full add/edit/delete, staff permissions, meter readings and bulk billing, TrxID payment verification, expenses and reports, plus a renter portal.

## Run
```bash
cp .env.example .env     # set DATABASE_URL (PostgreSQL) and AUTH_SECRET
npm install
npx prisma db push      # run again after every update: new tables and fields were added
npx prisma db seed
npm run dev
```
Logins (password `password123`): owner@basha.test, admin@basha.test, renter phone 01811000002.

## Staff permissions
Owners have every permission. Staff get the ones ticked on the Staff page; changes apply on their next request.

## PDF receipts
Run `npm install` (adds @react-pdf/renderer). For Bengali on receipts, save `NotoSansBengali-Regular.ttf` into `public/fonts/` (see the README.txt there). Without it receipts print in English only. Receipts open from Payments (landlord) and the renter portal.

## Uploads
NID front/back (landlord, on the renter form) and payment screenshots (renter, on the pay form) are saved under `UPLOAD_DIR` (default `./uploads`, outside `public`) and served only through `/api/files/...` after an access check. JPG, PNG, WebP or PDF, up to 5 MB, file type verified by content. This needs a server with a persistent disk; for serverless hosting replace `saveUpload` in `src/lib/uploads.ts` with a cloud bucket.

Records are never deleted: invoices, payments and expenses cannot be deleted, move-out archives the renter under Former renters, and landlords are suspended rather than removed.

Styling: Tailwind CSS 3 with shadcn-style components (`src/components/ui`), Lucide icons, sonner toasts and dark/light mode (toggle button bottom-right). Plain HTML elements are styled globally in `src/app/globals.css`, so new pages look consistent without extra classes.

Not built yet: nothing from the original brief.

## Access and security
- Only the super admin creates landlords, and decides which features each landlord (and their staff) can use, plus a custom flat limit.
- Everyone can change their own password under Account. There is no email reset: renters and staff ask their landlord, landlords ask the administrator.
- Phone numbers are normalised, so 01711000001, +8801711000001 and 8801711000001 are the same login.
- Five wrong passwords lock an account for 15 minutes.
- Suspending a landlord blocks their staff and renters on their next request.
- Move-out records the refund actually paid and a note.
- Seeding twice no longer duplicates the demo data.

## Money handling
- **Receive payment** on an invoice records cash, bKash, Nagad, Rocket, Upay or bank money received in person and approves it at once. Paying more than the due keeps the excess as the flat's advance credit, which is applied to the next invoice automatically.
- Invoices get a **due date** (set the day under Setup, Rent rules). The **Overdue** page lists unpaid flats with a WhatsApp reminder each and can add a **late fee** once per overdue invoice.
- Every approval, rejection, undo, adjustment, recorded payment, setup change and staff change is written to the **Activity log** (owner only, cannot be edited).
- **Export CSV** (opens in Excel) is on Invoices, Payments, Expenses and Reports. Add `?month=2026-03` to an export link for one month.
- **Bill PDF** (Invoices page, renter portal) and **receipt PDF** are bilingual when the Bengali font is installed.
- Rent changes are recorded with the old and new rent (flat Edit window shows the history).
- Staff can be limited to certain buildings. Those staff cannot manage property, expenses or reports.
- Renters can report repair problems, and see notices and their lease end date. Landlords answer under Repair requests.
- Language: the button in the menu switches between English and Bengali. The menu, overview, login and renter portal are translated; the landlord forms and setup screens are English only.

## Tests and backups
`npm test` runs unit tests for the money rules (status, partial payments, credit, meter charges, due dates, phone numbers). `scripts/backup.sh` dumps the database and the uploads folder; run it daily from cron and copy the result off the server.
