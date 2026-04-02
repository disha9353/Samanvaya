const fs = require('fs');
const path = 'frontend/src/pages/FeedPage.tsx';
let code = fs.readFileSync(path, 'utf8');

const oldBlock = "        const res = await http.get(`/api/items?${qs}`)\r\n        if (ignore) return\r\n        setItems(res.data.items || [])";
const newBlock = "        const res = await http.get(`/api/items?${qs}`)\r\n        if (ignore) return\r\n        const fetchedItems = res.data.items || []\r\n        console.log('[ItemsMap Debug] Total items fetched:', fetchedItems.length)\r\n        const withGPS = fetchedItems.filter((it) => it.location?.coordinates?.[0] !== 0 && it.location?.coordinates?.[1] !== 0)\r\n        console.log('[ItemsMap Debug] Items with valid GPS coords:', withGPS.length, withGPS.map((it) => ({ title: it.title, coords: it.location?.coordinates })))\r\n        setItems(fetchedItems)";

if (code.includes(oldBlock)) {
    code = code.replace(oldBlock, newBlock);
    fs.writeFileSync(path, code, 'utf8');
    console.log('Patched FeedPage with debug logs');
} else {
    console.log('Pattern not found, dumping search area...');
    const idx = code.indexOf('/api/items?');
    console.log(JSON.stringify(code.substring(idx - 30, idx + 120)));
}
