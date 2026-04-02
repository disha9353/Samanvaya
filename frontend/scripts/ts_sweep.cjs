const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const project = new Project({
    tsConfigFilePath: path.join(__dirname, '../tsconfig.json'),
});

project.addSourceFilesAtPaths(path.join(srcDir, '**/*.tsx'));
const sourceFiles = project.getSourceFiles();

const keysTracker = {};

function slugify(text) {
    return text.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .substring(0, 30)
        .replace(/^_+|_+$/g, '');
}

function shouldTranslate(text) {
    let t = text.trim();
    if (!t) return false;
    if (t.length < 2) return false;
    if (!/[a-zA-Z]/.test(t)) return false; 
    if (/^[\d\s.,!?]+$/.test(t)) return false; 
    return true;
}

let modifiedFiles = 0;

for (const sf of sourceFiles) {
    let fileModified = false;

    // 1. Process JSXText nodes <div>Text</div>
    const jsxTexts = sf.getDescendantsOfKind(SyntaxKind.JsxText);
    for (const node of jsxTexts) {
        let text = node.getText();
        if (text.includes('{') || text.includes('}')) continue;
        if (!shouldTranslate(text)) continue;
        
        const parent = node.getParent();
        if (parent && parent.getKind() === SyntaxKind.JsxElement) {
            const openingElem = parent.getOpeningElement();
            if (openingElem.getTagNameNode().getText() === 'style') continue;
        }

        const trimmed = text.trim();
        const key = `auto.${slugify(trimmed)}`;
        keysTracker[key] = trimmed;

        const preMatch = text.match(/^\s*/)[0];
        const postMatch = text.match(/\s*$/)[0];
        
        node.replaceWithText(`${preMatch}{t('${key}', \`${trimmed.replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`)}${postMatch}`);
        fileModified = true;
    }

    // 2. Process predefined JSXAttributes
    const attrs = sf.getDescendantsOfKind(SyntaxKind.JsxAttribute);
    for (const attr of attrs) {
        const name = attr.getNameNode().getText();
        if (['placeholder', 'title', 'alt', 'label', 'aria-label'].includes(name)) {
            const init = attr.getInitializer();
            if (init && init.getKind() === SyntaxKind.StringLiteral) {
                const text = init.getLiteralText();
                if (shouldTranslate(text)) {
                    const key = `auto.${name}_${slugify(text)}`;
                    keysTracker[key] = text;
                    attr.setInitializer(`{t('${key}', \`${text.replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`)}`);
                    fileModified = true;
                }
            }
        }
    }

    if (fileModified) {
        // Save AST first
        sf.saveSync();
        
        let content = fs.readFileSync(sf.getFilePath(), 'utf8');
        
        if (!content.includes("import { useTranslation } from 'react-i18next'")) {
            content = "import { useTranslation } from 'react-i18next';\n" + content;
        }

        // Smart injection: ONLY top-level React matching functions starting with capital letter
        const matchRegex = /^(export\s+default\s+function\s+[A-Z][a-zA-Z0-9_]*\s*\([^)]*\)\s*\{|export\s+const\s+[A-Z][a-zA-Z0-9_]*\s*[:=][^{]*=>\s*\{|function\s+[A-Z][a-zA-Z0-9_]*\s*\([^)]*\)\s*\{|const\s+[A-Z][a-zA-Z0-9_]*\s*[:=][^{]*=>\s*\{)(?!\s*const\s+\{\s*t\s*\})/gm;
        
        content = content.replace(matchRegex, "$1\n  const { t } = useTranslation();");
        
        fs.writeFileSync(sf.getFilePath(), content);
        modifiedFiles++;
    }
}

// 3. Patch JSON
const localesPath = path.join(srcDir, 'locales');
const localesToUpdate = ['en', 'hi', 'kn', 'te', 'ta', 'ml'];
localesToUpdate.forEach(loc => {
    const p = path.join(localesPath, `${loc}.json`);
    if(fs.existsSync(p)) {
        let json = JSON.parse(fs.readFileSync(p, 'utf8'));
        json.auto = json.auto || {};
        for(let key of Object.keys(keysTracker)) {
            const shortKey = key.split('.')[1];
            if(!json.auto[shortKey]) {
                json.auto[shortKey] = keysTracker[key];
            }
        }
        fs.writeFileSync(p, JSON.stringify(json, null, 2));
    }
});

console.log('Modified files:', modifiedFiles);
