import {toCanvas} from 'html-to-image';
import {collectDocumentText} from './readability.js';
import {detectMargins} from './margins.js';
// Honor saved page divisions, then paginate
// overflowing blocks. Oversized indivisible blocks are sliced without losing pixels.
export async function renderDocumentPages(setup,progress=()=>{},warnings=[]) {
  const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:absolute;left:-20000px;top:0;width:1200px;height:1600px;border:0;pointer-events:none';document.body.append(frame);
  const frameDoc=frame.contentDocument;frameDoc.open();frameDoc.write('<!doctype html><html><head><style>html{color-scheme:light}body{margin:0;background:white;color:black;font:12pt "Times New Roman"}*{box-sizing:border-box}p{margin:0}section.document-page{box-shadow:none;margin:0;flex-shrink:0}section.document-page>footer,section.document-page>header{padding:0;margin:0;letter-spacing:normal}</style></head><body><div id="pages"></div></body></html>');frameDoc.close();
  const host=frameDoc.getElementById('pages');
  try {
  await setup(host,frameDoc);
  // Imported documents cannot trigger external network requests or execute content.
  for(const el of host.querySelectorAll('script,iframe,object,embed'))el.remove();
  for(const img of host.querySelectorAll('img'))if(!img.src.startsWith('data:')&&!img.src.startsWith('blob:'))img.removeAttribute('src');
  await frameDoc.fonts.ready;
  await Promise.all([...host.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
  const sections=[...host.querySelectorAll('section.document-page')];
  if(!sections.length)throw new Error('This ODT document has no renderable pages.');
  const pages=[];let sliced=false;
  for(const section of sections) {
    const style=getComputedStyle(section),width=section.getBoundingClientRect().width;
    const height=parseFloat(style.minHeight)||1056;
    const article=section.querySelector('article');
    if(!article)continue;
    section.style.display='block';article.style.display='flow-root';article.style.flex='none';
    const top=parseFloat(style.paddingTop),bottom=parseFloat(style.paddingBottom),available=height-top-bottom;
    const footer=section.querySelector(':scope > footer');
    if(footer){const footerStyle=getComputedStyle(footer),distance=bottom+parseFloat(footerStyle.marginBottom||0);footer.style.cssText+=`;position:absolute;bottom:${Math.max(0,distance)}px;left:${style.paddingLeft};right:${style.paddingRight};margin:0;min-height:0`;}
    const articles=[...section.querySelectorAll(':scope > article')];
    const queue=articles.flatMap(el=>[...el.children]);for(const extra of articles.slice(1))extra.remove();article.replaceChildren();
    const before=pages.length;
    section.style.height=`${height}px`;section.style.minHeight=`${height}px`;section.style.overflow='hidden';
    async function capture() {
      progress(`Rendering ODT page ${pages.length+1}…`);
      pages.push({width:width*.75,height:height*.75,node:section.cloneNode(true)});
      article.replaceChildren();
      if(pages.length>500)throw new Error('ODT rendering is limited to 500 pages.');
    }
    while(queue.length) {
      const node=queue.shift();article.append(node);
      const overflow=Math.max(article.getBoundingClientRect().height,article.scrollHeight)>available+1;
      if(!overflow)continue;
      node.remove();
      if(article.children.length){
        const kept=[];
        while(article.lastElementChild?.dataset.keepNext==='true')kept.unshift(article.lastElementChild),article.lastElementChild.remove();
        if(article.children.length){await capture();queue.unshift(...kept,node);continue;}
        for(const heading of kept)article.append(heading);
        // A heading and its following block exceed a whole page. Keep them
        // together where possible without retrying the same group forever.
        if(kept.length){await capture();queue.unshift(node);continue;}
      }
      // Split tables at row boundaries before falling back to image slices.
      if(node.tagName==='TABLE'&&node.rows.length>1) {
        const remainder=node.cloneNode(true);const rows=[...node.rows];
        article.append(node);let cut=rows.length;
        while(article.getBoundingClientRect().height>available+1&&cut>1)node.rows[--cut].remove();
        if(article.getBoundingClientRect().height<=available+1){for(let i=0;i<cut;i++)remainder.rows[0].remove();await capture();queue.unshift(remainder);continue;}
        node.remove();
        // Restore the full table when even its first row is too tall to fit.
        while(node.rows.length)node.rows[0].remove();
        for(const row of rows)node.append(row);
      }
      // Split long paragraphs at word boundaries while preserving formatting runs.
      if(node.tagName==='P'&&node.textContent.length>1&&!node.querySelector('img,svg')) {
        article.append(node);
        const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT),textNodes=[];let n,total=0;
        while((n=walker.nextNode())){textNodes.push({node:n,start:total});total+=n.length;}
        const text=node.textContent,breaks=[...text.matchAll(/\s+/g)].map(m=>m.index+m[0].length);
        function parts(offset){let target=textNodes.findLast(t=>t.start<offset)||textNodes[0];const range=document.createRange();range.selectNodeContents(node);range.setEnd(target.node,offset-target.start);const first=node.cloneNode(false);first.append(range.cloneContents());range.selectNodeContents(node);range.setStart(target.node,offset-target.start);const rest=node.cloneNode(false);rest.append(range.cloneContents());return [first,rest];}
        let lo=0,hi=breaks.length-1,best=null;
        while(lo<=hi){const mid=Math.floor((lo+hi)/2),pair=parts(breaks[mid]);node.replaceWith(pair[0]);const fits=article.getBoundingClientRect().height<=available+1;pair[0].replaceWith(node);if(fits){best=pair;lo=mid+1;}else hi=mid-1;}
        if(best){node.replaceWith(best[0]);await capture();queue.unshift(best[1]);continue;}node.remove();
      }
      article.append(node);section.style.height='auto';section.style.overflow='visible';
      const tall=Math.max(height,section.scrollHeight);const image=await toCanvas(section,{pixelRatio:2,backgroundColor:'#fff',width,height:tall});
      for(let y=0;y<image.height;y+=height*2){const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=Math.round(height*2);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,y,image.width,Math.min(height*2,image.height-y),0,0,image.width,Math.min(height*2,image.height-y));pages.push({width:width*.75,height:height*.75,canvas});if(pages.length>500)throw new Error('ODT rendering is limited to 500 pages.');}
      sliced=true;article.replaceChildren();section.style.height=`${height}px`;section.style.overflow='hidden';
    }
    if(article.children.length||pages.length===before)await capture();
  }
  if(!pages.length)throw new Error('No pages could be rendered from this document.');
  for(const section of host.querySelectorAll('section.document-page'))section.remove();
  for(let i=0;i<pages.length;i++) {
    const page=pages[i];if(!page.node)continue;
    host.append(page.node);
    for(const field of page.node.querySelectorAll('[data-field]'))field.textContent=String(field.dataset.field==='total'?pages.length:i+1);
    progress(`Rendering ODT page ${i+1} of ${pages.length}…`);
    page.textSamples=collectDocumentText(page.node);
    page.canvas=await toCanvas(page.node,{pixelRatio:2,backgroundColor:'#fff',width:page.width/ .75,height:page.height/ .75});
    page.node.remove();delete page.node;
  }
  for(const page of pages)page.contentBounds=detectMargins(page.canvas,page.width,page.height);
  return {kind:'odt',pages,warnings:[...warnings,...(sliced?['An oversized ODT element was split across pages. Inspect the page boundaries for split text or images.']:[])]};
  } finally {frame.remove();}
}
