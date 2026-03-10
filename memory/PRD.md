# Valhallan Runners - Product Requirements Document

## Original Problem Statement
Mobile application for running coaches to manage their athletes. Features dual-role system (Coach/Athlete), program creation, workout tracking, subscription model (freemium with Stripe), and notification system.

## Business Model (Freemium)
- **Coach Free Plan**: Max 1 athlete, new coaches get 30-day trial
- **Coach Premium Plan**: Unlimited athletes via Stripe subscription (monthly/annual)
- **Athlete Access**: Always free

## Tech Stack
- **Frontend**: React Native, Expo SDK 54, Expo Router 6, Zustand, i18n-js, expo-localization
- **Backend**: FastAPI, Pydantic, MongoDB
- **Payments**: Stripe via emergentintegrations
- **Languages Supported**: Italian (it), English (en-GB, en-US), Spanish (es), French (fr), German (de)

## Core Features
1. **Authentication**: Coach login/register, Athlete login with access code
2. **Program Management**: Create, edit, assign training programs
3. **Workout Tracking**: Log workouts, activities, view history
4. **Analytics**: Performance metrics, comparisons
5. **Notifications**: Expiry alerts, updates
6. **Subscription**: Coach freemium model with real Stripe integration
7. **i18n**: Multi-language support with language selector

## What's Been Implemented

### March 10, 2025
- ✅ **Completed Stripe Subscription Flow**
  - Backend endpoints fully functional:
    - `GET /api/subscription/plans` - returns monthly/annual plans
    - `GET /api/subscription/status` - returns is_premium, athlete_count, athlete_limit
    - `POST /api/subscription/checkout` - creates Stripe checkout session
    - `GET /api/subscription/checkout/status/{session_id}` - verifies payment and activates subscription
    - `POST /api/webhook/stripe` - handles Stripe webhooks
  - Frontend success.tsx now properly updates Zustand state after payment
  - Cancel.tsx page fully internationalized
- ✅ **Fixed Back Button Bug**: Athlete detail page now uses `router.push('/(tabs)')` instead of `router.back()`
- ✅ **Added Subscription Translations**: 19 new translation keys for subscription flow in IT, EN-GB, EN-US

### March 3, 2025
- ✅ Implemented payment expiry notification system
  - Notifications sent 10 days before due date
  - Daily notifications from 3 days before until due date
  - Notifications sent to both coach and athlete
  - Auto-triggered when coach opens app
- ✅ Added endpoints: `/api/check-payment-expiries`, `/api/payment-expiries`
- ✅ Added payment translations to IT and EN

### Previous Implementation
- Full authentication system (Coach/Athlete)
- Program CRUD operations
- Workout/Activity logging
- Calendar view
- Analytics dashboard
- Notification system
- i18n base implementation with language selector

## Known Issues

### P0 - Critical
- None

### P1 - High Priority  
- Analytics endpoint `/api/analytics/athlete/{athlete_id}` needs data aggregation update
- Verify date display for payment expiries in athlete list

### P2 - Medium Priority
- Real-time fitness API integration (Garmin, Polar, Suunto)

## File Structure
```
/app
├── backend/
│   ├── server.py (Updated: Stripe endpoints lines 2433-2665)
│   └── .env (STRIPE_API_KEY configured)
└── frontend/
    ├── app/
    │   ├── subscription/
    │   │   ├── success.tsx (UPDATED - verifies payment, updates Zustand)
    │   │   └── cancel.tsx (UPDATED - i18n support)
    │   ├── athlete/[id].tsx (FIXED - back button uses router.push)
    │   └── (tabs)/profile.tsx (Stripe subscription UI)
    └── src/
        ├── i18n/locales/ (Updated subscription keys)
        └── store/authStore.ts (refreshSubscription, loadUser)
```

## Testing Status (March 10, 2025)
- ✅ Backend API: 16/16 tests passed (100%)
- ✅ Frontend UI: All pages render correctly (100%)
- ✅ Stripe checkout creates valid session
- ✅ Freemium model: 1 athlete limit for free tier
- ✅ Trial: 30 days for new coaches
- ✅ Back button: No crash on athlete detail page

## Next Tasks (Prioritized)
1. (P1) Update analytics endpoint with workout/activity data
2. (P2) Real-time fitness API integration
