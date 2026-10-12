import {chromium} from '@playwright/test';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('tmp/qa',{recursive:true});
const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
for(let i=1;i<=8;i++){const p=pdf.addPage([600,400]);p.drawRectangle({x:0,y:0,width:600,height:400,color:rgb(.96,.96,.96)});p.drawRectangle({x:10,y:320,width:70,height:60,color:rgb(1,0,0)});p.drawText(String(i),{x:270,y:190,size:40,font});p.drawText('TOP',{x:180,y:350,size:20,font});}
await writeFile('tmp/qa/passport-source.pdf',await pdf.save());
const cover=await PDFDocument.create();cover.addPage([612,792]).drawRectangle({x:0,y:0,width:612,height:792,color:rgb(.4,.2,.6)});await writeFile('tmp/qa/passport-cover.pdf',await cover.save());
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/');
 await page.locator('[data-preset=passport]').click();assert.equal(await page.locator('#cols').inputValue(),'1');assert.equal(await page.locator('#cover-orientation').inputValue(),'portrait');assert.ok(await page.locator('#rows').isDisabled());
 await page.locator('#file').setInputFiles('tmp/qa/passport-source.pdf');await page.waitForFunction(()=>document.querySelector('#sheet-position').textContent.includes('8 | 1'));
 await page.locator('#next').click();await page.waitForFunction(()=>document.querySelector('#sheet-position').textContent.includes('2 | 7'));await page.locator('#prev').click();await page.locator('#staple-marks').check();
 async function download(name){const pending=page.waitForEvent('download');await page.locator('#download').click();await(await pending).saveAs('tmp/qa/'+name);await page.waitForFunction(()=>!document.querySelector('#download').disabled);return readFile('tmp/qa/'+name);}
 const bytes=await download('passport.pdf');assert.equal((await PDFDocument.load(bytes)).getPageCount(),4);
 const check=await page.evaluate(async()=>{const {loadPdf,sourceCanvas}=await import('/src/pdf.js');const s=await loadPdf(await(await fetch('/tmp/qa/passport.pdf')).arrayBuffer());const items=(await s.pages[0].pdfPage.getTextContent()).items.filter(i=>/^[18]$/.test(i.str));const c=await sourceCanvas(s,0,1);return {items:items.map(i=>({text:i.str,tx:i.transform})),pixels:c.toDataURL()};});
 assert.ok(check.items.find(i=>i.text==='8').tx[0]<0);assert.ok(check.items.find(i=>i.text==='1').tx[0]>0);await writeFile('tmp/qa/passport-render.png',Buffer.from(check.pixels.split(',')[1],'base64'));
 await page.locator('#cover-options summary').click();await page.locator('#cover-file').setInputFiles('tmp/qa/passport-cover.pdf');await page.waitForFunction(()=>document.querySelector('#sheet-position').textContent.includes('Cover · front'));
 await page.locator('#orientation').selectOption('landscape');await download('passport-mixed.pdf');const mixed=await PDFDocument.load(await readFile('tmp/qa/passport-mixed.pdf'));assert.deepEqual(mixed.getPage(0).getSize(),{width:612,height:792});assert.deepEqual(mixed.getPage(2).getSize(),{width:792,height:612});
 await page.locator('#format').selectOption('odt');await download('passport-mixed.odt');await page.locator('#remove-cover').click();await page.locator('#file').setInputFiles('tmp/qa/passport-mixed.odt');await page.waitForFunction(()=>document.querySelector('#filename').textContent==='passport-mixed.odt'&&!document.querySelector('#download').disabled,{timeout:60000});assert.equal(await page.locator('#source-count').textContent(),'6');
 assert.deepEqual(errors,[]);console.log('Passport: fold ordering, inverted upper pages, separate portrait cover, mixed-size PDF/ODT and ODT roundtrip passed.');
}finally{await browser.close();}
