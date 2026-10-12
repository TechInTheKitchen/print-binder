import {chromium} from '@playwright/test';
import {PDFDocument,StandardFonts,degrees,rgb} from 'pdf-lib';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('tmp/qa',{recursive:true});
const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
for(const angle of [0,90,180,270]) {
  const p=doc.addPage([400,600]);p.setCropBox(20,30,350,520);p.setRotation(degrees(angle));
  p.drawRectangle({x:100,y:150,width:140,height:220,color:rgb(.8,.2,.1)});
  p.drawText(`Rotation ${angle}`,{x:110,y:340,size:12,font});
  p.drawRectangle({x:240,y:150,width:5,height:5,color:rgb(.1,.1,.8)});
}
doc.addPage([400,600]);
const bytes=await doc.save();await writeFile('tmp/qa/margin-source.pdf',bytes);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1400,height:1100}});await page.goto('http://127.0.0.1:5173/');
  const result=await page.evaluate(async bytes=>{
    const {loadPdf,sheetCanvas,exportPdf,sourceCanvas}=await import('/src/pdf.js');
    const {makeLayout}=await import('/src/layout.js');
    const {checkReadability}=await import('/src/readability.js');
    const source=await loadPdf(new Uint8Array(bytes).buffer),errors=[];
    const config={width:612,height:792,cols:2,rows:2,margin:18,gap:9,range:'',mode:'grid',trimMargins:true,trimPadding:5,consistentTrim:false};
    const raster={kind:'odt',pages:[]};for(let i=0;i<source.pages.length;i++)raster.pages.push({...source.pages[i],canvas:await sourceCanvas(source,i,2)});
    for(const input of [source,raster])for(const forceRotate of [false,true]) {
      const layout=makeLayout({...config,forceRotate},input.pages),out=await loadPdf(await (await exportPdf(input,layout,()=>{})).arrayBuffer());
      for(let side=0;side<layout.sides.length;side++) {
        const preview=await sheetCanvas(input,layout,side,1),output=await sourceCanvas(out,side,1);
        const a=preview.getContext('2d').getImageData(0,0,612,792).data,b=output.getContext('2d').getImageData(0,0,612,792).data;
        let diff=0;for(let i=0;i<a.length;i+=4)diff+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);
        errors.push(diff/(612*792*3));
      }
    }
    const trimmed=makeLayout(config,source.pages),full=makeLayout({...config,trimMargins:false},source.pages);
    return {errors,trimmed:trimmed.trimmed,bounds:source.pages.map(p=>p.contentBounds),small:checkReadability(trimmed.placements,source.pages).smallest,originalSmall:checkReadability(full.placements,source.pages).smallest};
  },[...bytes]);
  assert.equal(result.trimmed,4);assert.equal(result.bounds[4],null);assert.ok(result.small>result.originalSmall);
  assert.ok(result.errors.every(error=>error<2),JSON.stringify(result.errors));
  await page.locator('#file').setInputFiles('tmp/qa/margin-source.pdf');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('ready.'));
  assert.match(await page.locator('#margin-check').textContent(),/4 of 5/);
  await page.locator('#trim-margins').uncheck();assert.match(await page.locator('#margin-check').textContent(),/Original source margins retained/);
  await page.locator('#trim-margins').check();await page.locator('#consistent-trim').uncheck();
  await page.locator('#units').selectOption('mm');assert.equal(Number(await page.locator('#trim-padding').inputValue()),1.52);
  await page.screenshot({path:'tmp/qa/source-margins.png',fullPage:true});
  console.log('Margin checks passed: visible bounds, blank pages, all PDF rotations, vector export/preview agreement, text-size scaling, and controls.',result.errors);
} finally {await browser.close();}
