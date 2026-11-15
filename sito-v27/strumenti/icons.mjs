import {createRequire} from 'node:module';const {chromium}=createRequire(import.meta.url)('playwright');import fs from 'node:fs';
const [svgPath,out]=process.argv.slice(2);const svg=fs.readFileSync(svgPath,'utf8');const b=await chromium.launch();
for(const [n,s] of [['favicon-32.png',32],['apple-touch-icon.png',180],['favicon.png',192],['icon-512.png',512]]){const p=await b.newPage({viewport:{width:s,height:s}});await p.setContent(`<body style="margin:0;background:transparent">${svg.replace('width="192" height="192"',`width="${s}" height="${s}"`)}</body>`);await p.screenshot({path:out+'/'+n,omitBackground:true});await p.close()}
await b.close();
