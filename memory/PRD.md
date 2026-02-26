# Valhallan Runners - Product Requirements Document

## Original Problem Statement
Mobile application for running coaches to manage their athletes. Features dual-role system (Coach/Athlete), program creation, workout tracking, subscription model, and notification system.

## Tech Stack
- **Frontend**: React Native, Expo SDK 54, Expo Router 6, Zustand, i18n-js, expo-localization
- **Backend**: FastAPI, Pydantic, MongoDB
- **Languages Supported**: Italian (it), English (en-GB, en-US), Spanish (es), French (fr), German (de)

## Core Features
1. **Authentication**: Coach login/register, Athlete login with access code
2. **Program Management**: Create, edit, assign training programs
3. **Workout Tracking**: Log workouts, activities, view history
4. **Analytics**: Performance metrics, comparisons
5. **Notifications**: Expiry alerts, updates
6. **Subscription**: Coach subscription model (mock)
7. **i18n**: Multi-language support with language selector

## What's Been Implemented

### February 2025
- i18n implementation with i18n-js and expo-localization
- Language selector in Coach profile and Athlete home screens
- Translation files for IT, EN, ES, FR, DE
- Fixed root layout structure for Expo Router 6 compatibility

### Previous Implementation
- Full authentication system (Coach/Athlete)
- Program CRUD operations
- Workout/Activity logging
- Calendar view
- Analytics dashboard
- Notification system
- Subscription management (mock)

## Known Issues

### P0 - Critical
- None currently (runtime error potentially fixed - pending user test)

### P1 - High Priority  
- Incomplete translations: Some UI elements remain untranslated (e.g., "gestisci abbonamento")
- Analytics endpoint `/api/analytics/athlete/{athlete_id}` needs data aggregation update

### P2 - Medium Priority
- Real payment gateway integration (Stripe)
- Fitness API integration (Garmin, Polar, Suunto)

## File Structure
```
/app
├── backend/
│   └── server.py
└── frontend/
    ├── app/
    │   ├── _layout.tsx (Root layout - MODIFIED)
    │   ├── (tabs)/_layout.tsx
    │   ├── index.tsx (Entry/Login)
    │   ├── athlete-home.tsx
    │   └── ...
    ├── src/
    │   ├── i18n/
    │   │   ├── index.ts
    │   │   └── locales/*.json
    │   ├── store/
    │   ├── hooks/
    │   └── components/
    └── babel.config.js
```

## Testing Checklist
- [ ] App starts without runtime error
- [ ] Language switching works (Coach profile, Athlete home)
- [ ] All UI elements translate correctly
- [ ] Authentication flows work in both languages
- [ ] Program/workout CRUD operations functional
