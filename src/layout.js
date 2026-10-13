import {sourceCrops} from './margins.js';
export const papers = {letter:[612,792], tabloid:[792,1224], legal:[612,1008], a4:[595.276,841.89], a3:[841.89,1190.551]};
export function parseRange(value, count) {
  if (!value.trim()) return Array.from({length:count},(_,i)=>i);
  const pages=[];
  for (const item of value.split(',')) {
    const match=item.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Use page numbers or ranges, such as 1-8, 12.');
    const start=Number(match[1]),end=Number(match[2]??match[1]);
    if (start<1||end>count||start>count||end<start) throw new Error(`Page ranges must be ascending and between 1 and ${count}.`);
    for(let p=start;p<=end;p++) {pages.push(p-1);if(pages.length>10000)throw new Error('Select at most 10,000 pages.');}
  }
  return pages;
}
export function arrange(indices, cols, rows, mode, flow='row', reverse=false) {
  if(mode==='passport'){
    const columns=[];let first=0,last=indices.length-1;
    while(last-first+1>=4){columns.push({front:[indices[last],indices[first]],back:[indices[first+1],indices[last-1]]});first+=2;last-=2;}
    const remaining=last-first+1;
    if(remaining===3)columns.push({front:[indices[last],indices[first]],back:[indices[first+1],null]});
    else if(remaining>0)columns.push({front:[null,indices[first]],back:[remaining===2?indices[last]:null,null]});
    const sides=[];
    for(let start=0;start<columns.length;start+=cols){
      const front=Array(cols*2).fill(null),back=Array(cols*2).fill(null);
      for(let col=0;col<cols;col++){const pair=columns[start+col];if(!pair)continue;front[col]=pair.front[0];front[cols+col]=pair.front[1];back[col]=pair.back[0];back[cols+col]=pair.back[1];}
      sides.push(front,back);
    }
    return sides;
  }
  if(mode==='booklet') {
    const padded=[...indices];while(padded.length%(4*rows))padded.push(null);
    const sides=[];
    for(let sheet=0;sheet<padded.length/(4*rows);sheet++) {
      const front=[],back=[];
      for(let row=0;row<rows;row++) {
        const i=sheet*rows+row;
        front.push(padded[padded.length-1-2*i],padded[2*i]);
        back.push(padded[2*i+1],padded[padded.length-2-2*i]);
      }
      sides.push(front,back);
    }
    return sides;
  }
  const sides=[]; const cells=cols*rows;
  const ordered=reverse?[...indices].reverse():indices;
  for(let i=0;i<ordered.length;i+=cells) {
    const side=Array(cells).fill(null);
    for(let j=0;j<cells&&i+j<ordered.length;j++) {
      const slot=flow==='column'?(j%rows)*cols+Math.floor(j/rows):flow==='snake'?Math.floor(j/cols)*cols+(Math.floor(j/cols)%2?cols-1-j%cols:j%cols):j;
      side[slot]=ordered[i+j];
    }
    sides.push(side);
  }
  return sides;
}
export function makeLayout(config, pages) {
  const {width,height,cols,rows,margin,mode}=config;
  const gap=config.edgeToEdge?0:config.gap;
  const rowGap=config.edgeToEdge?0:config.rowGap??gap,pageScale=config.pageScale??100;
  if (![width,height,cols,rows,margin,gap].every(Number.isFinite)) throw new Error('Enter a valid number in every layout field.');
  if(width<72||height<72||width>3456||height>3456)throw new Error('Paper dimensions must be between 1 and 48 inches.');
  if(!Number.isInteger(cols)||!Number.isInteger(rows)||cols<1||rows<1||cols>16||rows>16)throw new Error('Choose whole numbers from 1 to 16 for rows and columns.');
  if(margin<0||gap<0)throw new Error('Margins and gaps cannot be negative.');
  if(!Number.isFinite(rowGap)||rowGap<0)throw new Error('Row gap must be a nonnegative number.');
  if(mode==='grid'&&(!Number.isFinite(pageScale)||pageScale<10||pageScale>100))throw new Error('Page scale must be between 10% and 100% of the available fit.');
  if(mode==='booklet'&&cols!==2)throw new Error('Folded booklets use 2 columns. Choose any number of rows.');
  if(mode==='passport'&&rows!==2)throw new Error('Passport booklets use 2 rows. Choose any number of columns.');
  let cellWidth=(width-2*margin-(cols-1)*gap)/cols,cellHeight=(height-2*margin-(rows-1)*rowGap)/rows;
  if(cellWidth<12||cellHeight<12)throw new Error('Margins or gaps leave too little room for the pages.');
  const indices=parseRange(config.range,pages.length),sides=arrange(indices,cols,rows,mode,config.flow,config.reverse);
  const padding=config.trimPadding??4.32;
  if(!Number.isFinite(padding)||padding<0||padding>72)throw new Error('Source padding must be between 0 and 1 inch (25.4 mm).');
  const crops=sourceCrops(pages,indices,config.trimMargins,padding,config.consistentTrim!==false);
  const shouldRotate=source=>mode!=='passport'&&(mode==='grid'&&config.forceRotate||config.rotate&&Math.min(cellWidth/source.height,cellHeight/source.width)>Math.min(cellWidth/source.width,cellHeight/source.height)+.00001);
  let originX=margin,originY=margin;
  if(config.edgeToEdge){
    const reference=crops[indices[0]],rotated=shouldRotate(reference),w=rotated?reference.height:reference.width,h=rotated?reference.width:reference.height;
    const cap=(mode==='grid'&&config.enlarge===false)||(mode==='passport'&&config.passportActualSize)?1:Infinity;
    const scale=Math.min(cellWidth/w,cellHeight/h,cap)*(mode==='grid'?pageScale/100:1);
    cellWidth=w*scale;cellHeight=h*scale;
    originX=(width-cols*cellWidth)/2;originY=(height-rows*cellHeight)/2;
  }
  let area=0,minScale=Infinity,croppedEdges=false;
  const placements=sides.map(side=>side.map((index,slot)=> {
    if(index===null)return null;
    let source=crops[index];const rotate=shouldRotate(source);
    if(config.edgeToEdge){
      const ratio=rotate?cellHeight/cellWidth:cellWidth/cellHeight;
      const cw=Math.min(source.width,source.height*ratio),ch=Math.min(source.height,source.width/ratio);
      if(cw<source.width-.01||ch<source.height-.01)croppedEdges=true;
      source={x:source.x+(source.width-cw)/2,y:source.y+(source.height-ch)/2,width:cw,height:ch};
    }
    const normal=Math.min(cellWidth/source.width,cellHeight/source.height),turned=Math.min(cellWidth/source.height,cellHeight/source.width);
    const fit=rotate?turned:normal,scale=config.edgeToEdge?fit:Math.min(fit,(mode==='grid'&&config.enlarge===false)||(mode==='passport'&&config.passportActualSize)?1:Infinity)*(mode==='grid'?pageScale/100:1);
    const w=(rotate?source.height:source.width)*scale,h=(rotate?source.width:source.height)*scale;
    area+=w*h;minScale=Math.min(minScale,scale);
    const alignX=mode==='grid'&&!config.edgeToEdge?config.alignX:'center',alignY=mode==='grid'&&!config.edgeToEdge?config.alignY:'center';
    const dx=alignX==='left'?0:alignX==='right'?cellWidth-w:(cellWidth-w)/2,dy=alignY==='top'?0:alignY==='bottom'?cellHeight-h:(cellHeight-h)/2;
    // Passport changes the imposition order, preserving source orientation.
    const turn180=false;
    return {index,rotate,turn180,scale,crop:source,width:w,height:h,x:originX+(slot%cols)*(cellWidth+gap)+dx,y:originY+Math.floor(slot/cols)*(cellHeight+rowGap)+dy};
  }));
  const blank=sides.flat().filter(p=>p===null).length,coverage=area/(sides.length*width*height);
  const warnings=[];
  if(croppedEdges)warnings.push('Edge-to-edge: source page shapes differ. Some edges are cropped to fill matching tiles. Review the preview for cut-off text or artwork.');
  if(config.edgeToEdge)warnings.push('Edge-to-edge joins page boundaries. White space already inside the source pages remains unless removed with source-margin trimming. Outer printer margins are retained.');
  if(coverage<.6)warnings.push(`${Math.round((1-coverage)*100)}% of the output sheet area is unused. Try a different orientation, fewer cells, or a paper size closer to your source pages.`);
  if(minScale<.5)warnings.push(`The smallest page is ${Math.round(minScale*100)}% of its original size. Fine print may be difficult to read.`);
  if(mode==='passport'){
    if(indices.length%4===2)warnings.push('The final occupied column contains a single double-sided center leaf. Cut away its unused half; bind only the printed leaf. No blank pages are inserted into the signature.');
    if(indices.length%2===1)warnings.push('An odd source-page count leaves one blank reverse in the bound signature. All other unused cells can be cut away.');
    if(blank)warnings.push(`${blank} unused print ${blank===1?'cell':'cells'} on the final sheet. Cut away empty columns or the unused half of the center-leaf column before binding.`);
  }else if(blank)warnings.push(`${blank} empty ${blank===1?'cell':'cells'} ${mode==='booklet'?`added to complete the ${4*rows}-page booklet sheet sequence`:'on the final output page'}.`);
  if(mode==='passport'&&cellWidth<=cellHeight)warnings.push('Passport cells are not landscape. Use portrait paper, fewer columns, or wider paper.');
  if(margin<9)warnings.push('Margins under 0.125 in may fall outside your printer’s printable area.');
  const unique=[...new Set(indices)],trimmed=unique.filter(i=>crops[i].width<pages[i].width-.1||crops[i].height<pages[i].height-.1);
  const removed=unique.reduce((sum,i)=>sum+1-crops[i].width*crops[i].height/(pages[i].width*pages[i].height),0)/unique.length;
  return {...config,gap,rowGap,originX,originY,indices,sides,placements,cellWidth,cellHeight,blank,coverage,minScale,warnings,trimmed:trimmed.length,removed};
}
