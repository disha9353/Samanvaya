const fs = require('fs');

const appLayoutPath = 'frontend/src/components/layout/AppLayout.tsx';
let code = fs.readFileSync(appLayoutPath, 'utf8');

// Use a regular expression that handles whitespace flexibly
const linkRegex = /<Link[^>]*to="\/items\/new"[^>]*>[\s\S]*?<\/Link>/g;
code = code.replace(linkRegex, '');

fs.writeFileSync(appLayoutPath, code, 'utf8');
console.log('Removed Create Item from Navbar in AppLayout.tsx');
