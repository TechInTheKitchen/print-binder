import {chromium} from '@playwright/test';
import JSZip from 'jszip';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('tmp/qa',{recursive:true});
const ns='xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"';
const zip=new JSZip();zip.file('mimetype','application/vnd.oasis.opendocument.text',{compression:'STORE'});
zip.file('content.xml',`<office:document-content ${ns}><office:automatic-styles><style:style style:name="Body" style:family="paragraph"><style:text-properties fo:font-size="9pt" fo:font-family="Georgia"/></style:style></office:automatic-styles><office:body><office:text><text:p text:style-name="Body">FIRST<text:span> HALF<text:soft-page-break/>SECOND HALF</text:span></text:p></office:text></office:body></office:document-content>`);
zip.file('styles.xml',`<office:document-styles ${ns}><office:automatic-styles><style:page-layout style:name="Small"><style:page-layout-properties fo:page-width="4.25in" fo:page-height="5in" fo:margin="0.25in"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Standard" style:page-layout-name="Small"><style:footer><text:p><text:page-number>99</text:page-number>/<text:page-count>99</text:page-count></text:p></style:footer></style:master-page></office:master-styles></office:document-styles>`);
const bytes=await zip.generateAsync({type:'nodebuffer'});await writeFile('tmp/qa/source.odt',bytes);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1400,height:1100}});await page.goto('http://127.0.0.1:5173/');
 const result=await page.evaluate(async bytes=>{const {loadOdt}=await import('/src/odt.js');const source=await loadOdt(new Uint8Array(bytes).buffer);return source.pages.map(p=>({width:p.width,height:p.height,count:p.textSamples.reduce((a,b)=>a+b.count,0),sizes:p.textSamples.map(s=>s.size),bounds:p.contentBounds}));},[...bytes]);
 assert.equal(result.length,2);assert.deepEqual(result.map(p=>p.count),[12,13]);
 for(const p of result){assert.equal(p.width,306);assert.equal(p.height,360);assert.ok(p.sizes.includes(9));assert.ok(p.bounds);}
 await page.locator('#file').setInputFiles('tmp/qa/source.odt');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('ready.'));
 assert.equal(await page.locator('#source-count').textContent(),'2');assert.match(await page.locator('#margin-check').textContent(),/2 of 2/);
 await page.locator('#format').selectOption('odt');const pending=page.waitForEvent('download');await page.locator('#download').click();const download=await pending;await download.saveAs('tmp/qa/odt-output.odt');
 const output=await readFile('tmp/qa/odt-output.odt');assert.equal(output.readUInt16LE(8),0);assert.equal(output.subarray(30,38).toString(),'mimetype');
 const packageZip=await JSZip.loadAsync(output);assert.equal(await packageZip.file('mimetype').async('string'),'application/vnd.oasis.opendocument.text');assert.ok(packageZip.file('META-INF/manifest.xml'));assert.ok(packageZip.file('Pictures/sheet-1.png'));
 await page.locator('#file').setInputFiles('tmp/qa/odt-output.odt');await page.waitForFunction(()=>document.querySelector('#filename').textContent==='odt-output.odt'&&!document.querySelector('#download').disabled);
 assert.equal(await page.locator('#source-count').textContent(),'1');await page.screenshot({path:'tmp/qa/odt-roundtrip.png',fullPage:true});
 console.log('ODT checks passed: saved break inside a span, inherited font size, page dimensions, dynamic fields, margins, package structure, and image-sheet roundtrip.');
} finally {await browser.close();}
