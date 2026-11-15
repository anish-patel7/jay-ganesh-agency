# Group collection verification — Revision 14 November 2026

## Requested workflow

- Customer can submit a personal installment record, but it is **Awaiting Leader** (not approved).
- Group Leader checks payment receipt and either rejects or **acknowledges** the member record, making it **Leader Verified** (not yet included in verified scheme credit).
- Group Leader selects the assigned group, and submits **one automatically calculated combined group amount** from acknowledged member records. All linked records are **Group Batch Pending**.
- Main Admin → Payments shows **group totals and Group Leader collection submissions only**, not a table of individual member installments, and verifies the **single group total**.
- Only when the Group Leader's combined group receipt is confirmed are its linked member records marked **Verified** for installment and order-credit calculation. A rejected group batch restores those linked records to **Leader Verified** for correction/re-submission.
- Group remittances are distinct from supplier transfers. Transfers cannot be counted twice as customer EMI payments.

## Screens changed

- Main Admin → Payments: group/leader/collection month/total/status and **Verify total** or Reject. Main Admin → Overview and Groups continue to show aggregate monthly EMI by group.
- Group Leader → Collections: reviews individual submissions and sees entries ready to include in a group collection.
- Group Leader → Transfers: automatically totals eligible member payments; collects remittance reference, month and mode, and submits an aggregate record.
- Customer → Installments: provides a payment entry with the assigned Group Leader as recipient, and shows each status until final group-level verification.
- In the browser demo, the Group Leader picker lets a reviewer simulate multiple leaders; in the backend, leader access is restricted to the leader's own assigned groups.

## API changes (server implementation only; not connected to the HTML demo)

- `GET /api/leader/group-collections`
- `POST /api/leader/group-collections`
- `GET /api/admin/group-collections`
- `POST /api/admin/group-collections/:id/verify` with `{ "confirmedReceived": true, "receivedAmount": 500 }`
- `POST /api/admin/group-collections/:id/reject` with a reason.
- Member EMI records may no longer be individually verified through `/api/admin/payments/:id/verify`; that route retains separate extra-order-payment handling.
- The `Payments` sheet has appended `batchId` and `Transfers` has appended `kind`, `groupId`, `period`, with existing `Transfer_Allocations` linking group remittances to included payments.

## Important limits

**Not a production accounting system.** All data in `preview.html` is demonstration data held in browser storage. The backend requires credentials, real authentication, approval policies, and independent reconciliation of physical/bank receipts. Google Sheets multi-record operations are not atomic; a production ledger should use transactions or a reviewed reconciliation recovery mechanism. No live collection or fireworks transaction is activated.

For browser-only migration, earlier local edits are read from the previous `jga2027_preview_v5` store into a v6 model. Older verified member rows remain historical; they are not silently recertified as newly verified group transfers. The sample reset contains one confirmed and one pending group batch for testing.
