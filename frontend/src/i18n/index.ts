import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';

import en_GB from './locales/en-GB.json';
import en_US from './locales/en-US.json';
import it from './locales/it.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import de from './locales/de.json';

const i18n = new I18n({
  'en-GB': en_GB,
  'en-US': en_US,
  'en': en_GB, // fallback for generic English
  'it': it,
  'fr': fr,
  'es': es,
  'de': de,
});

// Get device locale
const deviceLocale = Localization.getLocales()[0]?.languageTag || 'en-GB';

// Check if we support the device locale
const supportedLocales = ['en-GB', 'en-US', 'it', 'fr', 'es', 'de'];
const languageCode = deviceLocale.split('-')[0];

// Find best match
let bestMatch = 'en-GB'; // default

if (supportedLocales.includes(deviceLocale)) {
  bestMatch = deviceLocale;
} else if (supportedLocales.some(l => l.startsWith(languageCode))) {
  bestMatch = supportedLocales.find(l => l.startsWith(languageCode)) || 'en-GB';
}

i18n.locale = bestMatch;
i18n.enableFallback = true;
i18n.defaultLocale = 'en-GB';

export default i18n;
export { supportedLocales };
