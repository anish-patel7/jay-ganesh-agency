# Customer payment-entry visibility fix

- Confirmed: the customer `customerPay` form existed but was nested under Customer → Installments, following the installment schedule.
- Added Customer → Record Payment as a dedicated sidebar tab and an Overview shortcut.
- Put the submission form first, followed by individual customer-only status history.
- Show only installments with a remaining unsubmitted balance.
- Added optional receipt / UPI / bank reference in preview records.
- Display a message for accounts without an assigned Group Leader and for accounts with no outstanding installment entries.
- Preserved pending Customer → Leader Verified → Group Batch Pending → Main Admin group verification → Verified workflow. Main Admin's Payments tab remains group-only.
- No real payment collection or Google connection added.
