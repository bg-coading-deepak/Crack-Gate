// Website me kuch badla? Website folder ka path SITE me do, phir `npm run sync` chalao: files www/ me copy hoti hain aur app update ho jati hai.
const fs = require('fs'), path = require('path');
const SITE = process.env.SITE || path.join(__dirname, '..', 'crackgate');
const files = fs.readdirSync(SITE).filter(f => /^(index\.html|cg-.*\.js|logo\.png|favicon\.png|apple-touch-icon\.png|manifest\.webmanifest|sample-questions\.csv)$/.test(f));
if (!files.includes('index.html')) { console.error('index.html nahi mila. SITE path check karo: ' + SITE); process.exit(1); }
files.forEach(f => fs.copyFileSync(path.join(SITE, f), path.join(__dirname, 'www', f)));
// app-only rules (cg-app.js) must stay loaded after cg-ui.js
const ix = path.join(__dirname, 'www', 'index.html'); let h = fs.readFileSync(ix, 'utf8');
if (!h.includes('cg-app.js')) { h = h.replace('<script src="cg-ui.js"></script>', '<script src="cg-ui.js"></script>\n<script src="cg-app.js"></script>'); fs.writeFileSync(ix, h); }
console.log('Copied ' + files.length + ' files from ' + SITE);
