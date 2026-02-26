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

### February 26, 2025 (Update 2)
- ✅ Completed all missing translations for athlete home tabs (Today, Week, Month, History)
- ✅ Translated workout types (Easy, Tempo, Intervals, Long, Recovery)
- ✅ Translated section titles, empty state messages, action buttons
- ✅ Added 25+ new translation keys to athleteHome namespace
- ✅ All 5 language files (IT, EN, ES, FR, DE) fully synchronized

### February 26, 2025
- ✅ Fixed root layout structure for Expo Router 6 compatibility
- ✅ Completed all missing translations for athlete home screen
- ✅ Added 50+ translation keys to all 5 language files
- ✅ Translated: FAQ, Privacy modal, End Workout modal, Edit modal, Skip modal, View modal
- ✅ Translated: Tab navigation, certificate status, payment section
- ✅ Translated: Alert dialogs (delete athlete, program, workout)
- ✅ Bundle compiles successfully

### Previous Implementation
- Full authentication system (Coach/Athlete)
- Program CRUD operations
- Workout/Activity logging
- Calendar view
- Analytics dashboard
- Notification system
- Subscription management (mock)
- i18n base implementation with language selector

## Known Issues

### P0 - Critical
- None (runtime error fixed, pending user test)

### P1 - High Priority  
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
    │   ├── _layout.tsx (Root layout - FIXED)
    │   ├── (tabs)/_layout.tsx
    │   ├── athlete-home.tsx (UPDATED - full i18n)
    │   ├── athlete/[id].tsx (UPDATED)
    │   ├── program/[id].tsx (UPDATED)
    │   └── ...
    ├── src/
    │   ├── i18n/
    │   │   ├── index.ts
    │   │   └── locales/
    │   │       ├── it.json (UPDATED - 480 lines)
    │   │       ├── en-GB.json (UPDATED)
    │   │       ├── es.json (UPDATED)
    │   │       ├── fr.json (UPDATED)
    │   │       └── de.json (UPDATED)
    │   ├── store/
    │   └── hooks/
    └── babel.config.js
```

## Testing Checklist
- [x] Bundle compiles without errors
- [ ] App starts without runtime error (pending user test)
- [ ] Language switching works (Coach profile, Athlete home)
- [ ] All UI elements translate correctly
- [ ] Authentication flows work in both languages
- [ ] Program/workout CRUD operations functional
