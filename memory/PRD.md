# Valhallan Runners - Product Requirements Document

## Original Problem Statement
Mobile application for running coaches to manage their athletes. Features dual-role system (Coach/Athlete), program creation, workout tracking, subscription model (freemium with Stripe), and notification system.

## Business Model (Freemium)
- **Coach Free Plan**: Max 1 athlete, no free trial period
- **Coach Premium Plan**: Unlimited athletes via real Stripe subscription (monthly/annual)
- **Athlete Access**: Always free
- **Admin Account**: maxi1991@hotmail.it has permanent premium (is_admin flag)

## Tech Stack
- **Frontend**: React Native, Expo SDK 54, Expo Router 6, Zustand, i18n-js, expo-localization
- **Backend**: FastAPI, Pydantic, MongoDB
- **Payments**: Stripe (direct `stripe` Python library, NOT emergentintegrations)
- **Languages Supported**: Italian (it), English (en-GB, en-US), Spanish (es), French (fr), German (de)

## Core Features
1. **Authentication**: Coach login/register, Athlete login with access code
2. **Program Management**: Create, edit, assign training programs
3. **Workout Tracking**: Log workouts, activities, view history
4. **Analytics**: Performance metrics, comparisons
5. **Notifications**: Payment reminders (10 days before, daily from 3 days before due date)
6. **Subscription**: Coach freemium model with real Stripe integration
7. **Payment Log**: Private log for coach to record external payments (with delete)
8. **Deep Linking**: Post-Stripe payment redirect back to mobile app
9. **i18n**: Multi-language support with language selector

## What's Been Implemented

### April 2026
- Added back buttons to 5 deep-linked pages: program/[id].tsx, program/create.tsx, activity/[id].tsx, activity/upload.tsx, athlete/edit/[id].tsx
- Fixed missing imports (TouchableOpacity, Ionicons) in athlete/edit/[id].tsx that would have caused a crash
- All back buttons use safe router.push('/(tabs)') navigation (not router.back())
- Replaced Ngrok with Cloudflare Tunnel (cloudflared) for Expo preview
- Custom Expo QR Code endpoint at /api/expo-qr
- Notification system: reminders trigger 10 days before due date, daily from 3 days, continue if expired
- Fixed notification deduplication bug
- Added Notifications UI (bell icon + modal) to Athlete Dashboard
- Fixed notification click behavior (mark as read, not delete)

### February 2026
- Completed 'Delete Payment' feature (backend + frontend)
  - Backend: DELETE /api/athletes/{athlete_id}/payments/{payment_id}
  - Frontend: Delete button with confirmation dialog in athlete/[id].tsx payments tab
- Fixed recurring navigation bugs: replaced all router.back() with router.push('/(tabs)') across:
  - athlete/create.tsx, athlete/edit/[id].tsx, activity/[id].tsx, activity/upload.tsx
- Backend tests: 11/11 passed (payment CRUD, auth flow, freemium model)

### Previous Implementation
- Full Stripe integration with real keys, webhooks, deep linking
- Freemium model (1 free athlete, premium for unlimited)
- Admin role for maxi1991@hotmail.it (permanent premium)
- Notification logic for unpaid payments
- Full authentication system (Coach/Athlete)
- Program CRUD operations
- Workout/Activity logging with feedback system
- Calendar view
- Analytics dashboard
- i18n implementation with 6 languages

## Known Issues
### P1 - High Priority
- Analytics endpoint `/api/analytics/athlete/{athlete_id}` needs data aggregation update
- Expo tunnel: switched to cloudflared (DO NOT use ngrok)

### P2 - Medium Priority
- Real-time fitness API integration (Garmin, Polar, Suunto)
- server.py refactoring (3500+ lines, needs splitting into /routes/ and /services/)

## Key DB Schema
- `users`: id, email, name, role, subscription (plan, status, start_date, end_date), is_admin, stripe_customer_id
- `athletes`: id, coach_id, name, email, access_code, payments[], medical_certificate, biometrics
- `payments` (embedded in athletes): id, month, amount, paid, due_date, paid_date
- `programs`: id, coach_id, athlete_id, workouts[], name, start/end dates
- `subscriptions`: user_id/coach_id, plan, status, current_period_end, expires_at
- `notifications`: id, sender_id, recipient_id, title, message, notification_type, read

## File Structure
```
/app
├── backend/
│   ├── server.py (All backend logic: auth, CRUD, Stripe, webhooks, notifications)
│   └── .env (MONGO_URL, STRIPE keys)
└── frontend/
    ├── app.json (deep linking scheme: valhallanrunners)
    ├── app/
    │   ├── (tabs)/ (profile.tsx, _layout.tsx)
    │   ├── athlete/ ([id].tsx - detail + payments + delete, create.tsx, edit/[id].tsx)
    │   ├── activity/ ([id].tsx, upload.tsx)
    │   ├── subscription/ (success.tsx, cancel.tsx)
    │   ├── athlete-home.tsx (athlete dashboard)
    │   └── payment-success.tsx (deep link redirect)
    └── src/
        ├── hooks/useSubscription.ts
        ├── store/ (authStore.ts, dataStore.ts)
        └── i18n/locales/
```

## Testing Status (February 2026)
- Backend: 11/11 tests passed (100%) - Payment CRUD, Auth, Freemium
- Frontend: Navigation fixes applied (router.back -> router.push)

## Next Tasks (Prioritized)
1. (P1) Integrate workout/activity data into analytics endpoint `/api/analytics/athlete/{athlete_id}`
2. (P2) Refactor server.py into modular routes/services
3. (P3) Real-time fitness API integration (Garmin, Polar, Suunto)
