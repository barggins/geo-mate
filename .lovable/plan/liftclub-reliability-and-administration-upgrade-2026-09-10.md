# LiftClub reliability and administration upgrade

## Goal
Make the app consistently Johannesburg-focused, fast and reliable, while giving verified drivers safe payout controls and administrators broad, audited data management.

## Changes
- Replace the London/Reading demonstration route with Johannesburg and Braamfontein labels and imagery.
- Serve the walkthrough and logo as permanent local public assets, preload the landing image, add long-lived Vercel image caching, and preconnect to the Lovable Cloud backend.
- Remove unnecessary refresh work while preserving instant ride, chat, notification, and location updates.
- Add a validated banking-details form for drivers. Show verification status and prevent live location/online mode until payout details are verified.
- Expand the admin area into searchable sections for users, rides, bookings, groups, verification, payments, safety alerts, reviews, and audit history. Use server-verified admin actions, confirmation for destructive changes, and audit logging.
- Standardize the blue-and-black design tokens and simplify navigation, page headings, forms, loading states, and empty states across the touched screens.

## Security boundaries
- Administrators can manage product data but cannot access authentication secrets, raw passwords, or internal system schemas.
- Sensitive payment details remain masked where appropriate and all changes are validated, authorized, and audited.
- Database protections remain active; administration uses verified server-side permissions rather than weakening access rules.

## Validation
- Verify the landing image and Johannesburg route at desktop and mobile sizes.
- Verify settings validation and the blocked/unblocked online flow.
- Verify admin reads and representative edit/delete actions with an admin session.
- Run focused tests, confirm the preview has no runtime errors, and confirm the latest build is clean.
