// Sizes estimate physical font size in points; they do not guarantee legibility.
export function checkReadability(placements, pages, threshold=6) {
  const affected=new Set(),unknown=new Set();let smallest=Infinity,total=0,small=0;
  for(const side of placements)for(const p of side) {
    if(!p)continue;
    const samples=pages[p.index].textSamples;
    if(!samples?.length){unknown.add(p.index+1);continue;}
    for(const sample of samples){const size=sample.size*p.scale;if(!Number.isFinite(size)||size<=0)continue;smallest=Math.min(smallest,size);total+=sample.count;if(size<threshold){small+=sample.count;affected.add(p.index+1);}}
  }
  const warnings=[];
  if(affected.size){const list=[...affected].sort((a,b)=>a-b);warnings.push(`Small text: estimated minimum ${smallest.toFixed(1)} pt after scaling. About ${Math.round(100*small/total)}% of detected text is below your ${threshold} pt limit on source ${list.length===1?'page':'pages'} ${list.slice(0,12).join(', ')}${list.length>12?'…':''}. Use fewer cells, larger paper, less spacing, or a higher page scale.`);}
  if(unknown.size)warnings.push(`Text size could not be checked on source ${unknown.size===1?'page':'pages'} ${[...unknown].sort((a,b)=>a-b).slice(0,12).join(', ')}${unknown.size>12?'…':''}. These pages may be blank or contain image/outlined text; inspect them at print size.`);
  return {smallest:Number.isFinite(smallest)?smallest:null,affected:[...affected],unknown:[...unknown],warnings};
}
export function collectDocumentText(section) {
  const samples=[],walker=document.createTreeWalker(section,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){const count=node.textContent.replace(/\s/g,'').length;if(!count)continue;const parent=node.parentElement,style=getComputedStyle(parent);if(style.display==='none'||style.visibility==='hidden')continue;const size=parseFloat(style.fontSize)*.75;if(size>0)samples.push({size,count});}
  return samples;
}
