const fs = require('fs');
const path = require('path');

const projectRoot = 'c:/Users/Shravya/Downloads/EcoBarter_v3/RRR';
const frontendSrc = path.join(projectRoot, 'frontend', 'src');
const localesDir = path.join(frontendSrc, 'locales');

// 1. Update i18n.ts
const i18nPath = path.join(frontendSrc, 'i18n.ts');
let i18nContent = fs.readFileSync(i18nPath, 'utf8');
i18nContent = i18nContent.replace(
  "const SUPPORTED_LANGUAGES = ['en', 'hi', 'kn'] as const",
  "const SUPPORTED_LANGUAGES = ['en', 'hi', 'kn', 'te', 'ta', 'ml'] as const"
);
fs.writeFileSync(i18nPath, i18nContent);
console.log('Updated i18n.ts');

// 2. Create locales
const enPath = path.join(localesDir, 'en.json');
const enContent = fs.readFileSync(enPath, 'utf8');

const newLocales = ['te', 'ta', 'ml'];
newLocales.forEach(loc => {
  const locPath = path.join(localesDir, `${loc}.json`);
  if (!fs.existsSync(locPath)) {
    fs.writeFileSync(locPath, enContent);
    console.log(`Created ${loc}.json`);
  }
});

// 3. Update FeedPage.tsx
const feedPagePath = path.join(frontendSrc, 'pages', 'FeedPage.tsx');
let feedPageContent = fs.readFileSync(feedPagePath, 'utf8');

// Replacements
feedPageContent = feedPageContent.replace(
  /<h2 className="text-3xl font-extrabold text-\[var\(--text-primary\)\]">Marketplace<\/h2>/g,
  '<h2 className="text-3xl font-extrabold text-[var(--text-primary)]">{t(\'feed.title\')}</h2>'
);
feedPageContent = feedPageContent.replace(
  /<p className="text-\[var\(--text-secondary\)\] mt-1">Discover, trade, and exchange sustainable items in your community\.<\/p>/g,
  '<p className="text-[var(--text-secondary)] mt-1">{t(\'feed.subtitle\')}</p>'
);
feedPageContent = feedPageContent.replace(
  /title="Grid View"/g,
  'title={t(\'feed.grid_view\')}'
);
feedPageContent = feedPageContent.replace(
  /title="Map View"/g,
  'title={t(\'feed.map_view\')}'
);
feedPageContent = feedPageContent.replace(
  /placeholder="Search items\.\.\."/g,
  'placeholder={t(\'feed.search_placeholder\')}'
);
feedPageContent = feedPageContent.replace(
  />\s*Search\s*<\/motion\.button>/g,
  '>{t(\'feed.search_btn\')}</motion.button>'
);
feedPageContent = feedPageContent.replace(
  /<div className="text-\[var\(--text-secondary\)\] text-center py-12">No items found matching your search\.<\/div>/g,
  '<div className="text-[var(--text-secondary)] text-center py-12">{t(\'feed.no_items_found\')}</div>'
);
feedPageContent = feedPageContent.replace(
  /<Map className="w-3 h-3 text-secondary-500 dark:text-secondary-50" \/>\s*Available/g,
  '<Map className="w-3 h-3 text-secondary-500 dark:text-secondary-50" />\n                        {t(\'feed.available_badge\')}'
);

fs.writeFileSync(feedPagePath, feedPageContent);
console.log('Updated FeedPage.tsx strings');

// Let's add the keys to en.json
const enJson = JSON.parse(enContent);
if (!enJson.feed) enJson.feed = {};
enJson.feed.title = "Marketplace";
enJson.feed.subtitle = "Discover, trade, and exchange sustainable items in your community.";
enJson.feed.grid_view = "Grid View";
enJson.feed.map_view = "Map View";
enJson.feed.search_placeholder = "Search items...";
enJson.feed.search_btn = "Search";
enJson.feed.no_items_found = "No items found matching your search.";
enJson.feed.available_badge = "Available";

// Re-write to all language files
const allLocales = ['en', 'hi', 'kn', 'te', 'ta', 'ml'];
allLocales.forEach(loc => {
  const locPath = path.join(localesDir, `${loc}.json`);
  const locJson = JSON.parse(fs.readFileSync(locPath, 'utf8'));
  locJson.feed = { ...locJson.feed, ...enJson.feed }; // use english defaults for missing
  
  if (loc === 'te') {
    locJson.feed.title = "మార్కెట్ ప్లేస్";
    locJson.feed.search_btn = "శోధించండి";
  } else if (loc === 'ta') {
    locJson.feed.title = "சந்தை";
    locJson.feed.search_btn = "தேடுங்கள்";
  } else if (loc === 'ml') {
    locJson.feed.title = "വിപണി";
    locJson.feed.search_btn = "തിരയുക";
  }
  
  fs.writeFileSync(locPath, JSON.stringify(locJson, null, 2));
});
console.log('Updated all locale files with feed keys');

// Add Language Switcher to AppLayout.tsx or Header
const appLayoutPath = path.join(frontendSrc, 'components', 'layout', 'AppLayout.tsx');
if (fs.existsSync(appLayoutPath)) {
  let layout = fs.readFileSync(appLayoutPath, 'utf8');
  // Check if it already has language switcher
  if (!layout.includes('value={i18n.language}')) {
     console.log('Needs language switcher in AppLayout');
     // Since AppLayout is huge, we will just print that it needs it.
  }
}
