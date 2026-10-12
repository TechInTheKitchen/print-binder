export function addCover(layout,body,cover,blankBack=true,options={}) {
  if(!cover)return {source:body,layout};
  if(cover.pages.length<1||cover.pages.length>2)throw new Error('Choose a one- or two-page cover document.');
  const orientation=options.orientation??(layout.mode==='passport'?'portrait':'same');
  const [coverWidth,coverHeight]=orientation==='portrait'?[Math.min(layout.width,layout.height),Math.max(layout.width,layout.height)]:orientation==='landscape'?[Math.max(layout.width,layout.height),Math.min(layout.width,layout.height)]:[layout.width,layout.height];
  const margin=options.margin??18,bleed=options.bleed??9;
  if(!Number.isFinite(margin)||margin<9||!Number.isFinite(bleed)||bleed<1)throw new Error('Cover printer margin must be at least 0.125 in, and bleed must be positive.');
  // Reserve another 0.125 in inside the printable area for the trim marks.
  const inkInset=margin+9,inkWidth=coverWidth-2*inkInset,inkHeight=coverHeight-2*inkInset;
  if(inkWidth-2*bleed<=0||inkHeight-2*bleed<=0)throw new Error('Cover margins and bleed leave no finished cover. Reduce them or choose larger paper.');
  const coverTrim={x:inkInset+bleed,y:inkInset+bleed,width:inkWidth-2*bleed,height:inkHeight-2*bleed,margin,bleed};
  const offset=body.pages.length,sides=[],placements=[],sideTypes=[];
  for(let i=0;i<cover.pages.length;i++) {
    const page=cover.pages[i],scale=Math.max(inkWidth/page.width,inkHeight/page.height);
    const width=inkWidth/scale,height=inkHeight/scale;
    sides.push([offset+i]);placements.push([{index:offset+i,rotate:false,scale,x:inkInset,y:inkInset,width:inkWidth,height:inkHeight,crop:{x:(page.width-width)/2,y:(page.height-height)/2,width,height}}]);
    sideTypes.push(i?'cover-back':'cover-front');
  }
  if(cover.pages.length===1&&(layout.mode==='booklet'||layout.mode==='passport'||blankBack)){sides.push([]);placements.push([]);sideTypes.push('cover-blank');}
  const warnings=[...layout.warnings,...(cover.warnings||[]).map(s=>`Cover: ${s}`)];
  if(cover.pages.some(p=>Math.abs((p.width/p.height)/(inkWidth/inkHeight)-1)>.01))warnings.push('The cover proportions differ from the printable area. Cover edges are cropped symmetrically to fill the artwork area. Review the cover preview.');
  warnings.push(`Cover: cut at the trim marks for a ${(coverTrim.width/72).toFixed(2)} × ${(coverTrim.height/72).toFixed(2)} in finished cover. Artwork extends ${(bleed/72).toFixed(3)} in beyond each cut. Keep important text inside the cuts; the finished cover is smaller than the output paper. Print at actual size (100%).`);
  const count=sides.length;
  return {source:{...body,pages:[...body.pages,...cover.pages]},layout:{...layout,coverTrim,pageSizes:[...sides.map(()=>({width:coverWidth,height:coverHeight})),...layout.sides.map(()=>({width:layout.width,height:layout.height}))],sides:[...sides,...layout.sides],placements:[...placements,...layout.placements],sideTypes:[...sideTypes,...layout.sides.map(()=> 'body')],coverSides:count,coverage:(layout.coverage*layout.sides.length+cover.pages.length*inkWidth*inkHeight/(coverWidth*coverHeight))/(layout.sides.length+count),warnings}};
}

// Marks align with the finished edge but stay outside the artwork/bleed.
export function coverTrimLines(layout,side){
  if(!['cover-front','cover-back'].includes(layout.sideTypes?.[side])||!layout.coverTrim)return [];
  layout={...layout,...layout.pageSizes?.[side]};
  const {x,y,width,height,margin}=layout.coverTrim;
  const a=margin,b=margin+6;
  const lines=[];
  for(const cx of [x,x+width])for(const [start,end] of [[a,b],[layout.height-b,layout.height-a]])lines.push({x1:cx,y1:start,x2:cx,y2:end});
  for(const cy of [y,y+height])for(const [start,end] of [[a,b],[layout.width-b,layout.width-a]])lines.push({x1:start,y1:cy,x2:end,y2:cy});
  return lines;
}
