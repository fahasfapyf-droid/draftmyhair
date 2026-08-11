# Promo Code System

## Purpose
Allow administrators to issue reusable promotional codes that grant user generation credits.

## Rules
- Codes are case-insensitive and normalized to uppercase.
- A code grants a fixed number of credits per successful redemption.
- A user may redeem a given code only once.
- Codes can have an optional maximum total redemption count.
- Codes can have optional start and expiry dates.
- Administrators can activate/deactivate codes.
- Redemption usage is stored as individual records so the admin dashboard can show who redeemed each code and when.
- Successful redemption creates a `BONUS` credit transaction with promo metadata.
- Redemption and credit award happen in one serializable database transaction.
- Existing welcome/free-credit behavior is not removed by this feature.
