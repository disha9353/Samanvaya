const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .substring(0, 30) // limit key length
    .replace(/^_+|_+$/g, '');
}

function processJSXText(content, keysTracker) {
  // Regex to match string between tags > Some text <
  // Must contain at least one english letter to be considered text. Not just spaces/punctuation.
  const regex = />([^<>{]*[a-zA-Z][^<>{]*)</g;
  return content.replace(regex, (match, text) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) return match; // ignore very short or empty
    if (/^[\d\s.,!?]+$/.test(trimmed)) return match; // ignore numbers
    if (trimmed.startsWith('var(') || trimmed.includes('{') || trimmed.includes('}')) return match; // ignore css vars or JSX expr
    
    // Check if it's already translated
    if (trimmed.startsWith('t(')) return match;
    
    const key = `auto.${slugify(trimmed)}`;
    keysTracker[key] = trimmed;
    
    // Replace while keeping surrounding whitespace
    const preMatch = text.match(/^\s*/)[0];
    const postMatch = text.match(/\s*$/)[0];
    return `>${preMatch}{t('${key}', \`${trimmed.replace(/'/g, "\\'")}\`)}${postMatch}<`;
  });
}

function processJSXAttributes(content, keysTracker) {
  // Replace string attributes title="..." and placeholder="..." 
  const attrs = ['placeholder', 'title', 'alt', 'label'];
  attrs.forEach(attr => {
    const regex = new RegExp(`${attr}="([^"]*[a-zA-Z][^"]*)"`, 'g');
    content = content.replace(regex, (match, text) => {
      // Must not be already a curly brace or something weird
      if (text.includes('{') || text.includes('}')) return match;
      const key = `auto.${attr}_${slugify(text)}`;
      keysTracker[key] = text;
      return `${attr}={t('${key}', \`${text.replace(/'/g, "\\'")}\`)}`;
    });
  });
  return content;
}

function processFile(filePath, keysTracker) {
  if (filePath.endsWith('.d.ts')) return; // ignore definitions
  let content = fs.readFileSync(filePath, 'utf8');

  // If it doesn't look like a React component file with JSX, skip
  if (!content.includes('/>') && !content.includes('</')) return;

  const originalContent = content;

  content = processJSXText(content, keysTracker);
  content = processJSXAttributes(content, keysTracker);

  // If we made changes and the file doesn't have useTranslation
  if (content !== originalContent) {
    // Check if useTranslation is imported
    if (!content.includes('useTranslation')) {
      content = "import { useTranslation } from 'react-i18next';\n" + content;
    }
    
    // We also need to inject `const { t } = useTranslation();` into the component,
    // but doing this via regex for every component is error-prone.
    // So if it's not present, we will log it to see if it causes issues,
    // or try a simple heuristic:
    if (!content.includes('const { t } = useTranslation') && !content.includes('const { t, i18n }')) {
       // Look for "export default function ComponentName() {"
       // or "export const ComponentName = () => {"
       content = content.replace(/(export\s+(?:default\s+)?(?:function[^{]+|const\s+[a-zA-Z0-9_]+\s*=\s*(?:\([^)]*\)|[^=]*)\s*=>)\s*{)/, "$1\n  const { t } = useTranslation();\n");
    }

    fs.writeFileSync(filePath, content);
    console.log(`Updated translations in: ${path.relative(srcDir, filePath)}`);
  }
}

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      if (dirPath.endsWith('.tsx') || dirPath.endsWith('.ts')) {
        callback(dirPath);
      }
    }
  });
}

const keysTracker = {};
walkDir(srcDir, (filePath) => processFile(filePath, keysTracker));

// Now inject the keys into en.json
const localesPath = path.join(srcDir, 'locales');
const newLocales = ['en', 'hi', 'kn', 'te', 'ta', 'ml'];
newLocales.forEach(loc => {
  const jsonPath = path.join(localesPath, `${loc}.json`);
  if (fs.existsSync(jsonPath)) {
    let locData = {};
    try {
      locData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch(e) {}
    
    // Add keys tracker to auto namespace
    locData.auto = locData.auto || {};
    for (const [key, val] of Object.entries(keysTracker)) {
      const k = key.split('.')[1]; // 'auto.xxx' -> 'xxx'
      if (!locData.auto[k]) {
        locData.auto[k] = val; // fallback is English text
      }
    }
    fs.writeFileSync(jsonPath, JSON.stringify(locData, null, 2));
    console.log(`Updated locale file: ${loc}.json`);
  }
});

console.log('Sweep completed!');
