# Firestore Security Specification - Keerpunt Badgeboek

## 1. Data Invariants
1. Access to the school database (`/badgeboek/{docId}`) requires authenticated access by verified Google users belonging to Keerpunt (`keerpuntscholen.be`) or the bootstrapped administrator (`arno.boriau@keerpuntscholen.be`).
2. Document IDs must be strictly validated (`isValidId`) with alphanumeric, hyphen, or underscore characters under 128 bytes.
3. Catch-all security rule denies all access by default across arbitrary collections (`match /{document=**} { allow read, write: if false; }`).
4. Writing to `/test/{testId}` is denied to prevent resource exhaustion attacks; only `get` is permitted for connection liveness checks.
5. Deletion of global configuration or school year records is restricted to administrators.
6. Identity spoofing via fake email claims is prohibited; all writes require `request.auth.token.email_verified == true`.

## 2. The Dirty Dozen Payloads (Designed to Fail)
1. **Unauthenticated Read on Badgeboek**: Read attempt on `/badgeboek/_globaal` without `request.auth` token -> `PERMISSION_DENIED`.
2. **Unauthenticated Write on Badgeboek**: Attempting to write arbitrary evaluation data without credentials -> `PERMISSION_DENIED`.
3. **Unverified Email Write**: Write attempt with `email_verified: false` pretending to be admin -> `PERMISSION_DENIED`.
4. **Non-School Domain Write**: Write attempt with a verified public account (`attacker@gmail.com`) -> `PERMISSION_DENIED`.
5. **Path Traversal / ID Poisoning**: Document path `/badgeboek/../../passwords` or oversized 10KB doc ID -> `PERMISSION_DENIED`.
6. **Write to Test Collection**: Attempting `create` or `update` on `/test/connection` -> `PERMISSION_DENIED`.
7. **Deletion by Non-Admin**: Normal authenticated user attempting `delete` on `/badgeboek/2025-2026` -> `PERMISSION_DENIED`.
8. **Catch-All Arbitrary Collection Read**: Reading `/system_secrets/keys` -> `PERMISSION_DENIED`.
9. **Catch-All Arbitrary Collection Write**: Creating a document in `/admins/attacker` -> `PERMISSION_DENIED`.
10. **Missing Required School Year Field**: Updating `/badgeboek/2025-2026` removing the required `schooljaar` attribute -> `PERMISSION_DENIED`.
11. **Oversized String Injection**: Injecting a 2MB payload into `schooljaar` -> `PERMISSION_DENIED`.
12. **Null Resource Manipulation**: Calling write methods while bypassing verification -> `PERMISSION_DENIED`.
