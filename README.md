# Jay Ganesh Agency — Diwali 2027

## Going live (Google Sheet backend + Main Admin login)

The site at `/` is now the **live portal**: it talks to the Node server, which stores every record in your Google Sheet. The old browser-only demo is still available at `/demo/`.

**What you need:** a Google Sheet, a Google Cloud service account (free), and a free Render account.

1. **Google Cloud** (console.cloud.google.com): create a project → *APIs & Services → Enable APIs* → enable **Google Sheets API**. Then *IAM & Admin → Service Accounts → Create*, open it → *Keys → Add key → JSON*. A `.json` file downloads; keep it private.
2. **Google Sheet:** create a blank sheet. Click **Share**, paste the service account's email (`…@….iam.gserviceaccount.com`) and give it **Editor**. Copy the sheet ID from the URL (`docs.google.com/spreadsheets/d/<THIS PART>/edit`).
3. **Render** (render.com): sign in with GitHub → *New → Blueprint* → choose this repo. It reads `render.yaml` and asks for:
   - `GOOGLE_SHEETS_ID`: the ID from step 2
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: open the downloaded `.json` file and paste its **entire contents**
   - `ADMIN_MOBILE`: the 10-digit mobile number you will log in with
   - `ADMIN_PASSWORD`: your admin password (10+ characters)
4. Deploy. When it finishes, open the `https://….onrender.com` link. The badge at the top should say **Google Sheet connected**, and the server creates all worksheets (Customers, Payments, Groups…) in your sheet automatically.
5. Log in with the admin mobile and password. The admin area has Overview, Registrations (approve/reject), Customers and Groups.

### Hosting on Vercel instead (free Hobby plan, non-commercial)

The repo also works on Vercel: `vercel.json` serves `public/` and runs the backend from `api/index.js`. In Vercel → Project → **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `SERVER_ENABLED` | `true` |
| `GOOGLE_SHEETS_ID` | sheet ID |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | entire contents of the service-account `.json` file |
| `SESSION_SECRET` | any random text, 32+ characters |
| `ADMIN_MOBILE` | 10-digit admin mobile |
| `ADMIN_PASSWORD` | admin password, 10+ characters |

Then **Deployments → ⋯ → Redeploy**, because Vercel only applies new environment variables to new deployments.

`OPERATIONS_ENABLED`, `POLICY_APPROVED` and `FIREWORKS_LEGAL_CLEARANCE` stay `false` until you want customers to register, pay or order. To change any setting later, use Render → your service → **Environment**.

Free Render services sleep after 15 minutes without visitors, so the first visit after that takes about 30 seconds.

## Customer login — four-digit PIN (15 Nov 2026)

Customers enter a unique 10-digit mobile number and **exactly four numeric PIN digits** during registration. They confirm the PIN; once Main Admin approves, they use the same mobile and PIN to return to their permanent Customer ID. This replaces the previous 12-character customer password. Admin access retains a separate strong password. The data model continues to store only salted scrypt hashes (columns still named `passwordHash`/`passwordSalt` for backward schema compatibility). Direct buyer login also uses a 4-digit PIN.

**Old accounts:** Accounts registered under the previous long-password version cannot use their old password in the new PIN form. Main Admin must verify identity offline and issue a replacement temporary PIN through the verified administrative reset route. Existing Customer IDs, payments and groups are preserved. The browser preview has a matching Main Admin → Registrations → Customer PIN setup / reset demo option.

**Security:** A 4-digit PIN has only 10,000 combinations and is less secure than a long password. The API has per-IP (8/15 minutes) and per-mobile (5/15 minutes) rate limits, and stores only salted PIN hashes. A shared server-side/distributed attempt counter, additional abuse protections and independent security review are essential before live deployment. There is no OTP and phone ownership must be checked manually. Demo records remain local to one browser and are not secure or synchronized. Do not enter real data/PINs into the preview.

**Backend:** `POST /api/registration`, `POST /api/direct-signup` take `pin` (or legacy request-key `password`) with exactly 4 digits. `POST /api/auth/login` takes mobile+pin. `POST /api/auth/change-password` accepts `currentPin`, `newPin` (or old field aliases). Admin recovery provisions an identity-verified, one-time-displayed `temporaryPin` and forces its replacement before using protected API routes. Main Admin's deployment password remains at least 14 characters and is not replaced by a 4-digit PIN.

**Status: interactive website preview + optional server-side Google Sheets/Drive API source. Not production-ready or deployed.**

This project implements the **design and interactive browser preview** of the English-only, mobile-friendly portal requested in `PROJECT_SPECIFICATION.md`, plus a backend API implementation for later integration. It does **not** accept real payments, store actual uploaded PDFs, provide production user logins in the preview, or place live fireworks orders.

## View the website now

1. Open `preview.html` in Chrome, Edge or Firefox. It is a standalone, self-contained HTML file: no installation or server is needed.
2. Select **Explore portal** and switch among **Main Admin**, **Group Leader**, **Customer** and **Direct Buyer**.
3. Test sample registration and approval, group membership, EMI calculations, customer/leader submissions, group-total confirmation, supplier transfers, PDF filename simulation, order-step navigation, locking and audit events.
4. You can reset browser-local sample records from **Main Admin → Settings & audit**.

**Important:** Demo data lives in your browser's `localStorage`. It is neither secure nor connected to Google. Selecting a PDF in preview records its **filename only** and does not upload file contents. Demo Login is deliberately replaced by a role switcher. Customer identities in the preview are fictional. The eight box values now match the supplied price list, but they are not activated for production transactions.

## Website structure

- `preview.html`: ready-to-open standalone preview (all CSS and JS embedded).
- `public/index.html`, `public/styles.css`, `public/app.js`: editable website source.
- `server/rules.js`: financial calculations and deadline rules.
- `server/box-pricing.js`: eight supplied box tiers used to initialize an empty `Pricing_Master` worksheet.
- `server/store.js`: Google Sheets record adapter and worksheet initialization.
- `server/index.js`: protected Express API, role gates and private Google Drive PDF uploads.
- `tests/rules.test.js`: automated business-rule tests.
- `.env.example`: production backend configuration template.
- `PROJECT_SPECIFICATION.md`: complete input specification.

## Financial rules already covered by automated tests

- Monthly EMI: positive multiples of ₹100.
- First installment = 1.5×, next eight = 1×, total cash payable = 9.5×.
- One-time packing fee = 0.5×, **excluded from order credit**.
- Verified nine-month EMI contributions = 9×. Approved bonus = 1× only after full verification and explicit Main Admin approval.
- EMI scheme list and box discount = **50%** of advertised values.
- Credit utilization: discounted order total must cover the entire available credit before financial finalization.
- Extra payable = exact remaining amount; non-₹100 amounts and paise are supported by the API rule calculations.
- Direct orders use advertised prices and receive no EMI credit.
- PDF list orders remain pricing-pending until an authorized administrator supplies the approved price.

To run tests, install Node.js 20+ and run `npm test` in this folder. `npm test` uses Node's built-in test runner and does **not** require package installation.

## Connecting Google Sheets + Drive (advanced, before live use)

1. Create a Google Cloud project; enable **Google Sheets API** and **Google Drive API**.
2. Create a **service account**, download its JSON credentials and keep them **out of the site source and public folders**.
3. Create a blank Google Sheet and a separate **private** Google Drive folder. Share both with the service-account email using the minimum permissions needed. Use a suitable Drive/shared-drive arrangement with write access for the service account.
4. Copy `.env.example` to `.env`. Fill in Sheet ID, private Drive folder ID, service account JSON file path, session secret, admin mobile, and salted password hash. Generate the password pair with `node server/password-helper.js`.
5. Run `npm install`, then `node --env-file=.env server/index.js` with Node.js 20+.
6. The backend creates **the 17 specified sheets**, plus `Auth_Users`, `Customer_Summary` and `Group_Summary`. Its API responds at `/api/status`.
7. Keep `OPERATIONS_ENABLED=false`, `POLICY_APPROVED=false` and `FIREWORKS_LEGAL_CLEARANCE=false` until all required approvals have been obtained.

**The standalone browser preview has a local-only simulated mobile-and-password login but does not call the backend API.** Integrating a production login screen, API-driven dashboards, real uploads, secure password reset and deployment is still required. Do not confuse the interactive demo's local browser edits with live backend records.

## API highlights (when enabled)

Customer login is based on a 4-digit PIN, not OTP; an HttpOnly, SameSite cookie authenticates roles. Mutating requests require the `X-JGA-Request: 1` header and a matching request origin. Endpoints include:

- `POST /api/registration`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/change-password`.
- `GET /api/admin/registrations`, `POST /api/admin/registrations/:id/approve`, `POST /api/admin/registrations/:id/reject`.
- `GET /api/groups`, `POST /api/admin/groups`, `POST /api/admin/group-membership`, `POST /api/admin/groups/:id/leader`.
- `GET /api/customers`, `GET /api/payments`, `POST /api/payments`, `POST /api/admin/payments/:id/verify` (extra-order payments only), `POST /api/admin/bonus/:customerId`.
- `GET /api/leader/group-collections`, `POST /api/leader/group-collections`, `GET /api/admin/group-collections`, `POST /api/admin/group-collections/:id/verify`, `POST /api/admin/group-collections/:id/reject`.
- `GET /api/transfers`, `POST /api/transfers` (supplier transfers), `POST /api/admin/transfers/:id/confirm`, `POST /api/admin/transfer-allocations`, `GET /api/admin/reconciliation`.
- `GET /api/orders`, `POST /api/orders`, `PATCH /api/orders/:id/draft`, `POST /api/orders/:id/upload`, `POST /api/orders/:id/lock`.
- `POST /api/admin/uploads/:id/price`, `POST /api/admin/orders/:id/correct`, `POST /api/admin/orders/:id/financial-approve`, `GET /api/admin/reports`, `POST /api/admin/summaries/refresh`.
- `GET /api/admin/settings`, `PATCH /api/admin/settings/:window`; refund endpoints create manual-review records only.

API mutations are date-gated in the `Asia/Kolkata` timezone. Orders require additional legal clearance. Uploaded PDFs are validated and stored in a **non-public** Google Drive folder; API responses do not include the Drive file IDs. Authorization uses assigned customer or group.

## What must be completed before launch

- Connect all frontend dashboard actions to authenticated API routes; replace browser-only sample data and role switcher with actual login and real records.
- Obtain final terms and disclaimer, **refund policy**, incomplete-EMI exception procedures, payment receipts and accounting sign-off.
- Obtain applicable **fireworks trade, storage, online-ordering and local licensing/legal review** before enabling real ordering, sales or payment collection. Do not enable by changing environment flags alone.
- Have an independent developer and security expert review authentication, account recovery, role permissions, rate limiting, API input validation, file scanning, logging and backups.
- Put a transactional ledger/database or reviewed single-writer reconciliation strategy behind real financial transactions. Google Sheets is **not transaction-safe** under multiple writers.
- Configure actual pricing master data, PDF approval checks, operational transfer-allocation workflows, independent receipt reconciliation, and member-specific installment due dates if required. None should be invented from the specification.
- Add deployment infrastructure, HTTPS, monitoring, disaster recovery and end-to-end tests against a sandbox Google account.

**Deployment:** Not attempted. There is no live URL. The product is intentionally gated until approvals and integrations are complete.

## Revisions: box pricing and group-only Main Admin EMI verification

The eight priced box tiers from the prior revision remain unchanged: ₹4,000/₹2,000; ₹6,000/₹3,000; ₹8,000/₹4,000; ₹10,000/₹5,000; ₹12,000/₹6,000; ₹15,000/₹7,500 (new fancy); ₹20,000/₹10,000; ₹30,000/₹15,000 (fully fancy & out). Direct buyers use advertised prices.

**New payment flow:** Customer submits → Group Leader acknowledges → Group Leader sends one automatically summed group collection → Main Admin verifies the group total. Main Admin → Payments contains **no individual member installment verification buttons**. The leader continues to see member-level details in their assigned group. Group confirmation applies the included member installments once; a rejected batch returns them for leader correction. Group totals on the Admin dashboard show group monthly EMI, confirmed collections and pending collections.

For full technical details, data migration, and remaining controls, see `CHANGELOG_GROUP_COLLECTIONS.md`.

The backend's newly appended Google Sheet columns can be added automatically only when the existing header is an exact prefix match. Unexpected or reordered headings stop initialization for manual review. Browser preview edits are not synchronized to Google Sheets.

## Customer payment entry — navigation fix (15 Nov 2026)

The customer payment form existed previously under **Customer → Installments** and could be easily missed. It now has its own clearly labeled **Customer → Record Payment** menu entry and a **Record a payment** button directly on **Customer → Overview**. The Record Payment page shows the payment form **above** the customer's submission history.

Customers can record the installment number, amount, Cash/Online method, designated Group Leader recipient and optional transaction/receipt reference. Entries start as **Awaiting Leader**, and the customer can track subsequent statuses. Only Group Leader acknowledgement followed by a consolidated group submission and Main Admin group-level verification makes an EMI record **Verified**. Unverified records never increase customer EMI credit.

To test in the self-contained demonstration: **Explore portal → Customer → Record Payment**. Submit an amount for an installment that still has a balance. Then switch to **Group Leader → Collections** to acknowledge it. After acknowledgement submit it under **Group Leader → Transfers**, and finally check **Main Admin → Payments** for the group-total confirmation. The browser preview never transmits money or records to Google Sheets.
