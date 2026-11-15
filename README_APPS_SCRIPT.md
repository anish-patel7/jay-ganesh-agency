# Jay Ganesh Agency — GitHub + Vercel + Google Apps Script + Google Sheets

**Prepared for the existing GitHub repository:** `anish-patel7/jay-ganesh-agency` (Main Admin site currently at `/`, old browser-only demo at `/demo/`).

**Status:** Code prepared and 5 local tests passed with a **simulated** Google Sheet. **NOT deployed**, NOT tested with an actual Google account, NOT approved to handle real money or fireworks orders. The supplied ZIP is an **overlay / update**, not an independent replacement for all existing repo files. It intentionally leaves existing `server/`, `public/live.css`, and `public/demo/` untouched.

## What the integration implements

- Website served from GitHub-connected Vercel. At `/`, website can register new customers, log in as Admin/Customer/Group Leader, and access role-specific pages.
- A Vercel Function (`api/handler.js`) connects server-side to Apps Script. Browsers NEVER receive the script URL, shared secret, session key, or PIN hashing pepper.
- Apps Script writes to your Google Sheet under the Script owner's permission, and authorizes each role again even if the Vercel UI has a bug.
- Registration: name, mobile, reference, monthly EMI (₹100 multiples), 4-digit PIN, terms acceptance, admin approval, permanent Customer ID. Reuse the same mobile + PIN next month.
- Main Admin: registration approval/rejection, customer list, groups, group assignment, leader appointment, PIN reset after identity check, **group-total collections only**.
- Group Leader: sees only assigned group members, acknowledges/rejects each member's submitted payment, submits one summed collection with remittance method/reference.
- Customer: enters a payment already made, sees `Awaiting Leader`, then Group Leader review, then final `Verified` after Main Admin verifies the **group total**.
- Google Sheet includes the original worksheet structure plus `Group_Collections` and `Login_Attempts` (22 total). It initializes the 8 supplied box price tiers in `Pricing_Master` but **does NOT activate orders**.
- Login: admin strong password, customer four-digit PIN. Salted/peppered hash, server-stored failed-attempt lockout, session cookies (HttpOnly + SameSite=Strict + Secure on Vercel), origin checks, and audit records. Temporary PIN reset forces change.
- On first setup, operations, policies, and legal clearance are **false**. New registration/payment submissions are closed until required approval and appropriate dates.

## 1. Before starting — back up and use a test Sheet

1. Back up your existing GitHub project and any previous Google Sheet first.
2. For your first deployment, create a **new blank test spreadsheet** at https://sheets.new; name it `JGA 2027 TEST ONLY`.
3. In the Sheet's URL, copy only the long ID between `/d/` and `/edit`. For example, `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`.
4. This Apps Script architecture does **not** require a Google Cloud service-account JSON, Google Sheets API key, or Render. Keep any existing service-account JSON private and do not upload it.

**Migration warning:** The previous Node/Render backend stored customer PIN hashes using Node `scrypt`; this Apps Script backend uses a different salt/pepper scheme. Old users cannot simply sign in with those old hashes. Use a fresh test spreadsheet first; existing real data would require a carefully planned migration, customer PIN resets, and reconciliation. Do NOT point both live backends at the same sheet.

## 2. Create the Apps Script linked to your Sheet

1. Open the new Google Sheet.
2. Choose **Extensions → Apps Script**. Give the project a name, e.g. `JGA 2027 Sheets Gateway`.
3. In the left file list select `Code.gs`. Remove the starter code and paste the entire contents of **`appsscript/Code.gs`** from this package. Click **Save**.
4. Optional: In **Project Settings**, enable "Show appsscript.json manifest file in editor", then replace the manifest using `appsscript/appsscript.json` (V8, timezone Asia/Kolkata). The script will also explicitly format dates in Asia/Kolkata.
5. In **Project Settings → Script Properties**, add these values:

| Name in Apps Script | Value |
|---|---|
| `SPREADSHEET_ID` | The ID copied in Step 1 |
| `API_SHARED_SECRET` | A **random 64+ character** secret you generate privately; enter exactly the same value in Vercel as `GAS_SHARED_SECRET` |
| `PIN_PEPPER` | A **different** long random secret (64+ characters); NEVER put this in Vercel or GitHub |
| `ADMIN_MOBILE` | Main Admin's registered 10-digit Indian mobile |
| `ADMIN_PASSWORD` | Strong initial admin password, at least 14 characters, different from customer PINs |
| `OPERATIONS_ENABLED` | `false` |
| `POLICY_APPROVED` | `false` |
| `FIREWORKS_LEGAL_CLEARANCE` | `false` |

Generate random secrets with a reputable password manager. For developers with Node.js: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` (run once per secret). **Never paste secrets, private keys, real customer PINs, or a service-account JSON into GitHub, Vercel public variables, this chat, or source files.**

6. Return to the Apps Script editor. In the function selector at the top, select **`initializeJayGanesh`**, then click **Run**. Approve the Google authorization prompts after checking that this is the intended script and account.
7. Go back to the Sheet. You should see all **22 worksheets**, including `Registration_Requests`, `Customers`, `Groups`, `Payments`, `Group_Collections`, `Login_Attempts`, `Audit_Log`, `Auth_Users`, and `Pricing_Master`.
8. On first successful initialization the script salts/hashes `ADMIN_PASSWORD` and **deletes** that plaintext script property. Do not add `ADMIN_PASSWORD` back unless you intentionally arrange an admin credential reset. A reset should also increment `ADMIN_REV` to invalidate old sessions.

**Existing worksheet schema protection:** The initializer appends missing columns only when the existing headers exactly match a prefix of the new header list. On a mismatch it stops rather than deleting data. If it stops, do not reorder or erase existing financial records; review the migration first.

## 3. Publish Google Apps Script Web App

1. Open the Apps Script editor.
2. Click **Deploy → New deployment**.
3. Choose **Web app** as the deployment type.
4. Set **Execute as: Me** (the Google account that owns the Sheet).
5. Set **Who has access: Anyone** (required for server-to-server requests without every customer owning a Google account). The endpoint is publicly reachable, so the long shared secret and the Vercel server proxy are essential. DO NOT link users directly to this endpoint.
6. Click **Deploy**, authorize if asked, and copy the **Web app URL** ending in `/exec` (`https://script.google.com/macros/s/…/exec`).
7. Whenever you edit `Code.gs` later, use **Deploy → Manage deployments → Edit → New version → Deploy** so the published endpoint receives your changes. The `/dev` URL is for editors only and must not be used in Vercel.

Google's content service redirects responses to `script.googleusercontent.com`; the Vercel Function follows these redirects. Browser code never calls Apps Script directly.

## 4. Merge these files into your EXISTING GitHub repository

Repository: https://github.com/anish-patel7/jay-ganesh-agency

**Do not create a second unrelated project, upload the ZIP itself to GitHub, or delete your current repository.**

Recommended for beginners: use https://desktop.github.com/ (GitHub Desktop):

1. Sign in with your GitHub account and choose **File → Clone repository**; select `jay-ganesh-agency`.
2. Extract this ZIP to a temporary folder on your computer.
3. Copy the extracted `api`, `appsscript`, `public`, and `tests` directories, plus `vercel.json` and `README_APPS_SCRIPT.md`, into the **root of the cloned repository**; choose to **merge folders**, not replace entire folders. Replace existing `public/index.html` when prompted.
4. Existing `public/live.css`, `public/live.js`, `public/demo/`, `server/`, `package.json`, `render.yaml`, and all other files remain in place. The new index page loads **`/live-gas.js`**, not the old `/live.js`.
5. In GitHub Desktop, review the changed files. Make a new branch called `vercel-apps-script-test` (recommended). Enter commit message `Add Vercel private gateway and Apps Script Sheet integration`. Commit and **Publish branch**. Merge after a successful deployment/security review.

Files created or replaced:

```text
repo-root/
  vercel.json                 NEW: static output directory and security headers
  api/handler.js              NEW: server-only Vercel API (do not place in public/)
  appsscript/Code.gs           NEW: paste into Google Apps Script editor
  appsscript/appsscript.json  NEW: optional Apps Script manifest
  public/index.html           REPLACE: the live portal page
  public/live-gas.js          NEW: customer, leader, admin pages
  public/gas.css              NEW: styles that extend existing live.css
  tests/integration.test.js   NEW: local simulated-Sheet tests
  README_APPS_SCRIPT.md       NEW: these instructions
  public/live.css             EXISTING: KEEP
  public/demo/                EXISTING: KEEP
  server/                     EXISTING: KEEP (not run by Vercel)
```

## 5. Connect your existing GitHub repository to Vercel

1. Go to https://vercel.com/new and sign in with GitHub.
2. Import the **existing** `jay-ganesh-agency` repo, or if you already have a Vercel project, open it and verify its Git connection points to this repository.
3. Settings: **Framework Preset = Other**, **Root Directory = `./`**, **Output Directory = `public`**. `vercel.json` also pins `public`.
4. Open **Project → Settings → Environment Variables**. Add **server-side** variables only (do **not** prefix these with `NEXT_PUBLIC_`, `VITE_`, etc.):

| Name in Vercel | Value |
|---|---|
| `GAS_WEB_APP_URL` | Your published Apps Script `/exec` URL |
| `GAS_SHARED_SECRET` | Exact value entered as Apps Script's `API_SHARED_SECRET` |
| `SESSION_SECRET` | A **different** 64+ character random secret for signing login cookies |
| `NODE_ENV` | `production` (if not set automatically) |

5. Make sure the **Production** environment contains the values; add them to a protected Preview environment only when you intentionally test a branch with separate **test** credentials and Sheet. Do not point an untrusted PR preview at real customer data.
6. Deploy. Every new GitHub commit can trigger another deployment. If you add or change environment variables, create a new deployment; old deployments will not retroactively receive the updated values.
7. Open your Vercel site. At the top it should show **Google Sheet connected** after the connection is configured; if not, check the Vercel Function logs and Apps Script **Executions** page.
8. Log in as Main Admin with your `ADMIN_MOBILE` and initial strong `ADMIN_PASSWORD`. Only hashes remain in Script Properties after initialization.

**Important about cost:** Vercel Hobby is designated for **personal, non-commercial** projects. The Jay Ganesh Agency commercial site should use a suitable paid plan for real business use. Apps Script and Google Sheets have usage quotas. This solution is not a guarantee of unlimited free production hosting.

## 6. Test safely — use dummy mobile numbers and fake payments ONLY

First leave `OPERATIONS_ENABLED=false` and `POLICY_APPROVED=false` to verify that customer registration and payment entry stay closed while Admin login, group management, and Sheet reads work.

For an isolated test Sheet with authorized test-only operating policies, change `OPERATIONS_ENABLED=true` and `POLICY_APPROVED=true` in **Apps Script → Script Properties** (not Vercel); ensure registration dates are in the project window (9–30 Nov 2026). Do **not** do this on a production Sheet without approved terms, financial rules, and legal review.

1. Register two dummy customers with two distinct 10-digit mobile numbers and their own 4-digit PINs.
2. Main Admin → Registrations → approve both. Confirm rows appear in `Customers`, `Auth_Users`, and `EMI_Schedule`.
3. Main Admin → Groups → create `TEST GROUP 1`; assign both customers; appoint one as Group Leader.
4. Sign out; log in as the other Customer → **Record Payment** → enter ₹500, for an eligible installment. This is a record of a test payment, NOT money sent online. Confirm `Payments.status = Awaiting Leader`.
5. Log in as Group Leader → **Member Payments** → acknowledge the payment. Group Leader → **Submit Group Collection** → choose it and submit the combined amount. The total must be calculated automatically by Apps Script, not typed by the leader.
6. Log in as Main Admin → **Group Collections** → verify the combined group total only. Confirm all included member Payments transition to `Verified`, and the customer's verified credit updates. Reject a different test batch to verify it returns to the leader queue without credit.
7. Test Main Admin → **PIN Reset** after checking identity; login using the temporary PIN, then change to a personal four-digit PIN.
8. Test incorrect PIN, unauthorized role access, double verification, under/overpayment rejection, duplicate mobiles, and browser refresh.
9. Before real data, reset both operation flags to `false`, keep fireworks ordering disabled, and review Google Sheet access, reconciliation, independent backups and logs.

Run the automated simulated tests locally from the repository root:

```bash
node --test tests/integration.test.js
```

They verify the integration logic without a Google account. They are **not** a substitute for a live deploy test.

## 7. Security and production limitations — read before using real money

1. The **Apps Script Web App executes as the organizer**. Anyone can reach its URL, but requests must include the high-entropy server-only shared secret. Keeping that secret out of browser JavaScript and public GitHub source is mandatory. A leaked secret can compromise every worksheet and must be rotated in BOTH Apps Script and Vercel.
2. A four-digit PIN has only 10,000 combinations. The script stores salted/peppered hashes, locks a mobile number after five failed attempts for 30 minutes, and requires Admin identity checks for resets. For real use, additional central IP/device throttling, anti-bot measures, MFA/recovery design, PIN policy and independent security review are necessary. The existing login lockout is not immune to distributed abuse or account-lockout attacks.
3. Main Admin has no per-member EMI verification API or buttons. Leader verifies members; Admin verifies each **aggregated** remittance. Admin must independently reconcile cash/bank receipt. The site itself does **not** collect payments or issue payment receipts.
4. Apps Script `LockService.getScriptLock()` serializes mutations *within this script*, but multi-sheet updates are not atomic and Sheets is **not a financial transactional ledger**. Failed partial writes can require manual repair. Before real financial records, use a transactional database or independently audited reconciliation strategy, backups, idempotency controls and incident recovery.
5. This package intentionally omits working list-PDF uploads, direct-buyer ordering, order locking, order payment/discount finalization, refunds, supplier remittance, Google Drive file handling, and activation of online fireworks orders. Existing `/demo/` is a local mock ONLY. Do not equate its visual functions with live backend functionality.
6. The original business rules need completed refund/incomplete EMI decisions, approved customer terms, authorized pricing approvals and relevant fireworks trading/legal clearance before turning on real operations.
7. The previous Render/Node Sheets service and this Apps Script service must not both write to the same live Google Sheet during migration. Do not switch a real site by only changing environment variables without reconciliation.
8. Restrict Sheet sharing to trusted staff, regularly back up it, protect Google account with MFA, and do not put actual customer PINs or transaction screenshots into public bug reports or logs.
9. Google Apps Script quotas (including a 6-minute per-execution limit) may affect a high-traffic portal. Vercel Functions also have plan limits. Test performance and failure behavior for your actual load.
10. The serverless login session is signed and has a 12-hour expiry. Admin PIN reset invalidates the customer's earlier sessions. Logout clears the browser cookie; there is no session database or global logout-all endpoint. A security review is needed before production.

**Official references:**
- Apps Script Web Apps: https://developers.google.com/apps-script/guides/web
- Apps Script Content Service redirects: https://developers.google.com/apps-script/guides/content
- Apps Script Lock Service: https://developers.google.com/apps-script/reference/lock/lock-service
- Apps Script quotas: https://developers.google.com/apps-script/guides/services/quotas
- Vercel Functions: https://vercel.com/docs/functions
- Vercel GitHub setup: https://vercel.com/docs/git/vercel-for-github
- Vercel pricing: https://vercel.com/pricing
