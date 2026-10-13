import { PDFDocument, degrees, rgb } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {detectMargins} from './margins.js';
import {staplePoints,stapleSize} from './staples.js';
import {coverTrimLines} from './cover.js';
pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
export async function loadPdf(bytes,progress=()=>{},maxPages=Infinity) {
  const document=await PDFDocument.load(bytes);
  const render=await pdfjs.getDocument({data:new Uint8Array(bytes.slice(0)),isEvalSupported:false}).promise;
  if(render.numPages>maxPages){await render.destroy();throw new Error(`Choose a cover document with at most ${maxPages} pages.`);}
  const pages=[];let hasAnnotations=false;
  for(let i=1;i<=render.numPages;i++) {
    const page=await render.getPage(i),v=page.getViewport({scale:1});
    if((await page.getAnnotations()).length)hasAnnotations=true;
    const textSamples=[];
    try{const text=await page.getTextContent();for(const item of text.items){if(!item.str?.trim()||!item.transform)continue;const tx=pdfjs.Util.transform(v.transform,item.transform),size=Math.hypot(tx[2],tx[3]);if(size>0)textSamples.push({size,count:item.str.replace(/\s/g,'').length});}}catch{/* Unavailable text is reported by the readability check. */}
    pages.push({width:v.width,height:v.height,pdfPage:page,original:document.getPage(i-1),textSamples});
    progress(`Detecting margins on PDF page ${i} of ${render.numPages}…`);
    const canvas=await sourceCanvas({pages},i-1,Math.min(1.5,1000/Math.max(v.width,v.height)));
    pages.at(-1).contentBounds=detectMargins(canvas,v.width,v.height);
  }
  return {kind:'pdf',document,render,pages,warnings:hasAnnotations?['This PDF contains annotations or form fields. PDF export embeds page content only; annotation appearances and interactive fields may be omitted. Flatten them in the source, or choose ODT image output to retain the visible preview.']:[]};
}
export async function sourceCanvas(source,index,scale=1.5) {
  const page=source.pages[index];
  if(page.canvas)return page.canvas;
  const viewport=page.pdfPage.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  await page.pdfPage.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
  return canvas;
}
export async function sheetCanvas(source,layout,side,scale=1.5) {
  layout={...layout,...layout.pageSizes?.[side]};
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(layout.width*scale);canvas.height=Math.ceil(layout.height*scale);
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(scale,scale);
  for(const p of layout.placements[side]) {
    if(!p)continue;
    const img=await sourceCanvas(source,p.index,Math.min(2,Math.max(.5,p.scale*scale)));
    const original=source.pages[p.index],crop=p.crop||{x:0,y:0,width:original.width,height:original.height};
    const sx=crop.x/original.width*img.width,sy=crop.y/original.height*img.height,sw=crop.width/original.width*img.width,sh=crop.height/original.height*img.height;
    ctx.save();ctx.translate(p.x,p.y);
    if(p.turn180){ctx.translate(p.width,p.height);ctx.rotate(Math.PI);}
    if(p.rotate){ctx.translate(p.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(img,sx,sy,sw,sh,0,0,p.height,p.width);}else ctx.drawImage(img,sx,sy,sw,sh,0,0,p.width,p.height);
    ctx.restore();
  }
  if(layout.sideTypes?.[side]?.startsWith('cover')){
    ctx.strokeStyle='#333';ctx.lineWidth=.5;
    for(const {x1,y1,x2,y2} of coverTrimLines(layout,side)){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
    return canvas;
  }
  if(layout.guides){ctx.strokeStyle='#aaa';ctx.lineWidth=.4;ctx.setLineDash([2,2]);for(let row=0;row<layout.rows;row++)for(let col=0;col<layout.cols;col++)ctx.strokeRect((layout.originX??layout.margin)+col*(layout.cellWidth+layout.gap),(layout.originY??layout.margin)+row*(layout.cellHeight+layout.rowGap),layout.cellWidth,layout.cellHeight);}
  ctx.strokeStyle='#666';ctx.lineWidth=.6;ctx.setLineDash([]);
  for(const {x,y} of staplePoints(layout,side)){ctx.beginPath();ctx.moveTo(x-stapleSize,y);ctx.lineTo(x+stapleSize,y);ctx.moveTo(x,y-stapleSize);ctx.lineTo(x,y+stapleSize);ctx.stroke();}
  return canvas;
}
export async function exportPdf(source,layout,progress) {
  const out=await PDFDocument.create();out.setTitle('Print Binder — arranged pages');out.setCreator('Print Binder');
  const embedded=new Map();
  for(let side=0;side<layout.sides.length;side++) {
    progress(`Preparing output page ${side+1} of ${layout.sides.length}…`);
    const sheet={...layout,...layout.pageSizes?.[side]},page=out.addPage([sheet.width,sheet.height]);
    for(const p of layout.placements[side]) {
      if(!p)continue;
      if(source.pages[p.index].original&&source.pages[p.index].pdfPage) {
        const original=source.pages[p.index].original;
        if(!original.node.Contents())continue; // Keep empty source pages as white cells.
        if(!embedded.has(p.index)){
          const sourcePage=source.pages[p.index],crop=p.crop||{x:0,y:0,width:sourcePage.width,height:sourcePage.height};
          const viewport=sourcePage.pdfPage.getViewport({scale:1});
          const corners=[[crop.x,crop.y],[crop.x+crop.width,crop.y],[crop.x,crop.y+crop.height],[crop.x+crop.width,crop.y+crop.height]].map(point=>viewport.convertToPdfPoint(...point));
          embedded.set(p.index,await out.embedPage(original,{left:Math.min(...corners.map(p=>p[0])),bottom:Math.min(...corners.map(p=>p[1])),right:Math.max(...corners.map(p=>p[0])),top:Math.max(...corners.map(p=>p[1]))}));
        }
        const embed=embedded.get(p.index),angle=((original.getRotation().angle+(p.rotate?90:0)+(p.turn180?180:0))%360+360)%360;
        const x=p.x,y=sheet.height-p.y-p.height;
        const offsets={0:[0,0],90:[0,p.height],180:[p.width,p.height],270:[p.width,0]}[angle];
        page.drawPage(embed,{x:x+offsets[0],y:y+offsets[1],xScale:p.scale,yScale:p.scale,rotate:degrees(-angle)});
      } else {
        if(!embedded.has(p.index)){
          const sourcePage=source.pages[p.index],img=sourcePage.canvas,crop=p.crop||{x:0,y:0,width:sourcePage.width,height:sourcePage.height};
          const clipped=document.createElement('canvas');clipped.width=Math.max(1,Math.ceil(crop.width/sourcePage.width*img.width));clipped.height=Math.max(1,Math.ceil(crop.height/sourcePage.height*img.height));
          clipped.getContext('2d').drawImage(img,crop.x/sourcePage.width*img.width,crop.y/sourcePage.height*img.height,crop.width/sourcePage.width*img.width,crop.height/sourcePage.height*img.height,0,0,clipped.width,clipped.height);
          embedded.set(p.index,await out.embedPng(clipped.toDataURL('image/png')));
        }
        const img=embedded.get(p.index),y=sheet.height-p.y-p.height;
        const angle=(p.rotate?90:0)+(p.turn180?180:0),offsets={0:[0,0],90:[0,p.height],180:[p.width,p.height],270:[p.width,0]}[angle];
        page.drawImage(img,{x:p.x+offsets[0],y:y+offsets[1],width:p.rotate?p.height:p.width,height:p.rotate?p.width:p.height,rotate:degrees(-angle)});
      }
    }
    if(layout.sideTypes?.[side]?.startsWith('cover')){
      for(const {x1,y1,x2,y2} of coverTrimLines(layout,side))page.drawLine({start:{x:x1,y:sheet.height-y1},end:{x:x2,y:sheet.height-y2},thickness:.5,color:rgb(.2,.2,.2)});
      continue;
    }
    if(layout.guides)for(let r=0;r<layout.rows;r++)for(let c=0;c<layout.cols;c++)page.drawRectangle({x:(layout.originX??layout.margin)+c*(layout.cellWidth+layout.gap),y:layout.height-(layout.originY??layout.margin)-r*(layout.cellHeight+layout.rowGap)-layout.cellHeight,width:layout.cellWidth,height:layout.cellHeight,borderColor:rgb(.65,.65,.65),borderWidth:.4});
    for(const {x,y} of staplePoints(layout,side)){
      const color=rgb(.4,.4,.4),cy=layout.height-y;
      page.drawLine({start:{x:x-stapleSize,y:cy},end:{x:x+stapleSize,y:cy},thickness:.6,color});
      page.drawLine({start:{x,y:cy-stapleSize},end:{x,y:cy+stapleSize},thickness:.6,color});
    }
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return new Blob([await out.save()],{type:'application/pdf'});
}
