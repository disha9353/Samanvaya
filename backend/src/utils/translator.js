const en = require('./locales/en.json');
const hi = require('./locales/hi.json');
const kn = require('./locales/kn.json');

const MESSAGES = { en, hi, kn };
const DEFAULT_LANGUAGE = 'en';
const MAX_KEY_LENGTH = 80;

function normalizeLanguage(language) {
  if (!language) return DEFAULT_LANGUAGE;
  const base = String(language).split(',')[0].split('-')[0].toLowerCase();
  return MESSAGES[base] ? base : DEFAULT_LANGUAGE;
}

function normalizeKey(key) {
  const safe = String(key)
    .trim()
    .replace(/[\s.-]+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toUpperCase();

  return safe.length > MAX_KEY_LENGTH ? safe.slice(0, MAX_KEY_LENGTH) : safe;
}

function getMessage(key, language) {
  const lang = normalizeLanguage(language);
  const k = normalizeKey(key);

  return (
    MESSAGES[lang]?.[k] ??
    MESSAGES[DEFAULT_LANGUAGE]?.[k] ??
    k
  );
}

module.exports = { getMessage };

