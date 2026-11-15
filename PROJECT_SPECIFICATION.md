# Jay Ganesh Agency — Diwali 2027
## Final Website Development Specification — Parts 1 & 2

### Project Overview

Create a simple, secure, mobile-friendly, English-only website for managing the Jay Ganesh Agency Diwali 2027 private group contribution and order arrangement.

The website has two integrated modules:

- Part 1: Customer Registration, EMI, Groups, Payments and Collections.
- Part 2: EMI-Linked and Direct Order Management.

Use Google Sheets for structured records and Google Drive for private PDF order files.

## 1. Customer Registration

- Registration without SMS OTP.
- Collect full name, mobile number, reference person, monthly EMI amount and optional comments.
- Monthly EMI must be a positive multiple of ₹100.
- Require acceptance of the group's terms and disclaimer.
- Save registration as Pending Approval.
- Main Admin approves or rejects registration.
- Generate a permanent Customer ID after approval.
- Provide secure non-OTP login credentials.
- Prevent duplicate customer records.

## 2. EMI Calculation

The customer chooses a fixed monthly EMI amount.

- First EMI = Monthly EMI × 1.5.
- First installment includes a one-time packing charge of Monthly EMI × 0.5.
- Remaining eight installments = Monthly EMI each.
- Total cash payable = Monthly EMI × 9.5.
- Packing charges are excluded from order credit.
- Track the one-month bonus separately.
- Fully eligible customers receive one additional month's EMI as bonus credit.

Example for ₹500 monthly EMI:

- First installment: ₹750.
- Next eight installments: ₹4,000 total.
- Total paid: ₹4,750.
- Packing charge: ₹250.
- EMI contributions: ₹4,500.
- Eligible bonus: ₹500.
- Total EMI Scheme Credit: ₹5,000.

Scheme dates:
- Start: 9 November 2026.
- Registration deadline: 30 November 2026.
- Final EMI deadline: 31 July 2027.

Incomplete EMI cases require explicit Main Admin review. No automatic bonus or exceptional credit may be applied without approval.

## 3. Group Management

- Main Admin creates groups after registration.
- Assign members using reference persons and mutual acquaintances.
- Appoint one Group Leader per group.
- Group size is flexible.
- Allow Main Admin to transfer members between groups.
- Preserve group membership and leadership history.
- Group Leaders see only their assigned members.

## 4. Payment Collection

Support Cash and Online payment records.

- Customers, Group Leaders and Main Admin can submit payment details.
- Record the actual recipient of each payment.
- Group Leaders acknowledge money received from their members.
- Main Admin performs final verification.
- Only verified payments count toward customer EMI balances.
- Track transfers from Group Leaders to Main Admin.
- Track funds forwarded from Main Admin to the Sivakasi supplier.
- Keep all internal transfers separate from customer payments.
- Maintain reconciliation and audit records.

## 5. Order Management

Support two order categories.

### EMI-Linked Order
- Retrieve the customer's approved account.
- Retrieve group, EMI amount and verified payment history.
- Calculate available EMI scheme credit.
- Apply the eligible scheme discount and bonus.
- Allow additional payment when order value exceeds available credit.

### Direct Order
- No EMI account required.
- No EMI credit or bonus.
- Apply regular undiscounted prices.
- Allow Main Admin to assign the buyer to a group or manage directly.

## 6. Eight-Step Order Form

1. Customer Details.
2. Installment Details (skip for direct orders).
3. Order Type — Only Box, Only List, Both.
4. Number of Lists.
5. Mandatory PDF Upload for list-based orders.
6. Box Requirement Confirmation.
7. Box Quantities and Automatic Totals.
8. Final Order Summary and Confirmation.

Use conditional navigation.

Box tiers must be stored in a configurable Pricing_Master sheet.

For uploaded lists:
- Accept PDF files.
- Support multiple lists.
- Automatically generate unique filenames.
- Save files in private Google Drive storage.
- Require authorized pricing confirmation.

## 7. Final Scheme Pricing and Unused Credit Rule

For eligible EMI-linked orders, apply a 50% scheme discount to the approved chit price-list value.

For box orders, use the approved scheme box prices, equivalent to 50% of the advertised values for the listed tiers.

Calculate:

Discounted Order Value = Total Eligible Crackers List Value × 0.50.

Available EMI Credit = Verified Eligible EMI Contributions + Approved One-Month Bonus.

Extra Amount Payable = MAX(0, Discounted Order Value − Available EMI Credit).

### Mandatory Full-Credit Utilization

The customer must select enough crackers to use the complete available EMI credit.

The following condition is compulsory:

Discounted Order Value >= Available EMI Credit.

If the order's discounted value is lower than the available credit:
- Display the unused-credit amount.
- Display how much additional crackers list value is required.
- Ask the customer to add more crackers.
- Do not treat the difference as a refundable amount.
- Do not silently forfeit unused credit.
- Do not finalize an under-value order.

Example:

Available EMI Credit: ₹5,000.

Selected Crackers List Value: ₹8,000.

Discounted Order Value: ₹4,000.

Unused Credit: ₹1,000.

Additional Crackers List Value Required: ₹2,000.

Once the customer selects ₹10,000 total list value, the discounted order price is ₹5,000, completely utilizing the available credit.

If the selected list value becomes ₹12,000:
- Discounted Order Price: ₹6,000.
- Applied EMI Credit: ₹5,000.
- Additional Payable: ₹1,000.

Allow exact additional payment amounts, including amounts not divisible by ₹100.

### List Order Pricing Validation

When PDF pricing is pending, keep the monetary validation pending.

Before financial finalization, confirm that the approved PDF-list and box subtotals use the available EMI credit fully.

If a locked order is found to be under-value after PDF pricing, flag it for Main Admin correction. Do not alter customer selections silently.

### Direct Orders

Direct orders use regular undiscounted prices and have no EMI scheme credit.

The mandatory EMI-credit utilization rule does not apply to direct orders.

## 8. Order Locking

- One order per customer.
- Allow draft saving and customer editing before locking, within the order window.
- Provide a Lock Order action with confirmation.
- Once locked, customers cannot edit order details or upload replacements.
- Only Main Admin can correct locked orders.
- Record administrator identity, change reason, previous value, new value and timestamp.
- Do not allow creating another order to bypass the lock.

A customer lock freezes the customer's selections, but administrator pricing review, financial validation and approved corrections may continue.

## 9. Admin Live/Stop Control

Provide three independent controls:

### Registration
9 November 2026 to 30 November 2026.

### EMI Payment Submission
9 November 2026 to 31 July 2027.

### Order Collection
Configurable opening date in June 2027 and closing date of 31 July 2027.

Each control supports:
- Live.
- Stop.
- Configurable start and end dates.
- Automatic closing.
- Server-side enforcement.
- Administrative audit trail.

Use Asia/Kolkata timezone.

After closing, authorized administrators may continue reviewing and reconciling existing records.

## 10. User Dashboards

### Main Admin
- Registration approval.
- Customer and Group Management.
- Group Leader assignment.
- EMI and payment verification.
- Group collection reconciliation.
- Transfer management.
- Order pricing and approval.
- Credit utilization validation.
- Locked-order corrections.
- Refund reviews.
- Live/Stop controls.
- Financial reports.

### Group Leader
- Assigned member details.
- EMI collections.
- Pending payments.
- Group transfers.
- Group order submissions.
- Additional payment collections.

### Customer
- EMI amount and payment schedule.
- Verified payment history.
- Pending installments.
- Available scheme credit.
- Group information.
- Order form.
- Final pricing and additional payable amount.
- Order locking and confirmation.

### Direct Buyer
- Direct order form.
- Regular undiscounted pricing.
- Order status.
- Payment history and outstanding balance.

## 11. Google Sheets Structure

Create these worksheets:

1. Registration_Requests
2. Customers
3. Direct_Order_Contacts
4. Groups
5. Group_Memberships
6. EMI_Schedule
7. Payments
8. Transfers
9. Transfer_Allocations
10. Pricing_Master
11. Orders
12. Order_Boxes
13. Order_Uploads
14. Order_Adjustments
15. Refunds
16. Audit_Log
17. Settings

Add calculated Customer_Summary and Group_Summary views.

The Orders and Order_Adjustments data must track:

- Total Advertised List Value.
- Box Subtotal.
- List Subtotal.
- Total Discounted Order Value.
- Verified EMI Contributions.
- Approved Bonus Credit.
- Available EMI Credit.
- Applied EMI Credit.
- Unused Credit Before Finalization.
- Extra Amount Payable.
- Extra Payment Verified.
- Final Outstanding Balance.
- Order Lock Status.
- Pricing Verification Status.

Use unique IDs and server-side Google Sheets integration.

## 12. Security and Design

- English only.
- Mobile-first interface.
- Minimal text.
- No OTP requirement.
- Secure non-OTP login.
- Role-based access permissions.
- Protected PDF uploads.
- Backend validation of calculations and deadlines.
- Audit trail for administrative changes.
- Clearly displayed terms and disclaimer.
- No automatic refund rule until the conflicting original conditions are clarified and approved.
- Obtain applicable compliance clearance before activating online fireworks ordering or sales functionality.

## 13. Delivery

Provide complete working website source code, customer and admin interfaces, group dashboards, secure Google Sheets integration, Google Drive file handling, pricing calculations, locking and approval workflows, deployment instructions and testing procedures.

Do not activate features dependent on unresolved legal or financial rules before those rules are approved.