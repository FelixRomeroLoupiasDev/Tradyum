# Security Specification (TDD)

## 1. Data Invariants
*   **User Identity**: Users can only access, create, update, or delete records nested within their own `/users/{userId}/...` path. Cross-user reading or writing is disallowed.
*   **Id Alignment**: Any document created must have its internal ID matching the document ID path parameter (e.g. `incoming().id == accountId`).
*   **Data Constrains**: Text and numerical values must conform to size and pattern limits to avoid denial-of-service / wallet exhaustion.
*   **Type Correctness**: All critical properties are validated with exact types (e.g. `name is string`, `balance is number`).

## 2. Dirty Dozen Payloads (Target: PERMISSION_DENIED)
1. Write to user profile with anonymous/unset authentication.
2. Read user data of `user_B` as `user_A`.
3. Create trading account with a non-alphanumeric/malformed ID (resource poisoning test).
4. Create trading account under `user_B`'s root, even if signed in as `user_A`.
5. Update trading account balance with a string instead of a number.
6. Create draft trade with empty symbol or negative quantities.
7. Overwrite a trade belonging to another user.
8. Set account status to a value outside the enum (e.g., `status = "Robado"`).
9. Create a trade with symbol exceeding 100 characters.
10. Create a journal entry where internal id does not match the document key in the path.
11. Inject an arbitrary "ghost field" not matching schemas to test strict fields validation.
12. Attempt to read list of accounts of another user.

## 3. Test Cases Spec
These checks are mapped to our security rules:
*   `allow get, create, update` on `/users/{userId}` requires `isOwner(userId)`.
*   `allow read, write` on `/users/{userId}/accounts/{accountId}` requires `isOwner(userId)`.
*   `allow read, write` on `/users/{userId}/trades/{tradeId}` requires `isOwner(userId)`.
*   `allow read, write` on `/users/{userId}/journalEntries/{entryId}` requires `isOwner(userId)`.
