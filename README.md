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
