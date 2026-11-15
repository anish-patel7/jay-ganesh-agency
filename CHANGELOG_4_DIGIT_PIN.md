# Update — 4-digit customer PIN

- Customer registration now requests PIN and Confirm PIN, exactly four numeric digits.
- Login requests mobile number + PIN, allowing the same approved customer to return under the same Customer ID.
- The direct-buyer API also accepts four-digit PINs.
- Admin account keeps its separate strong password.
- Main Admin can verify an existing customer's identity and reset a preview PIN without deleting their records.
- Backend API enforces 4 digits, hashes with salted scrypt, adds per-mobile 5-attempt/15-min throttle (alongside existing per-IP throttle), and keeps admin-mediated identity checks for resets.
- Previous long-password accounts require identity-checked PIN reset; they are not silently migrated.
- Live deployment requires stronger centralized attempt throttling and security review given 10,000 possible PIN values.
- No EMI, group, payment, price, or order logic was changed.
