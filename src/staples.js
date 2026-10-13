// Coordinates are in output-sheet points, measured from the top left.
export function staplePoints(layout,side) {
  if(!layout.stapleMarks)return [];
  if(layout.sideTypes?.[side]?.startsWith('cover'))return [];
  const marks=[],placements=layout.placements[side];
  const originX=layout.originX??layout.margin,originY=layout.originY??layout.margin;
  if(layout.mode==='passport'){
    const y=originY+layout.cellHeight+layout.rowGap/2;
    for(let col=0;col<layout.cols;col++){
      if(![placements[col],placements[layout.cols+col]].some(Boolean))continue;
      const left=originX+col*(layout.cellWidth+layout.gap);
      for(const fraction of [1/3,2/3])marks.push({x:left+layout.cellWidth*fraction,y});
    }
  } else if(layout.mode==='booklet') {
    const x=originX+layout.cellWidth+layout.gap/2;
    for(let row=0;row<layout.rows;row++) {
      if(!placements.slice(row*2,row*2+2).some(Boolean))continue;
      const top=originY+row*(layout.cellHeight+layout.rowGap);
      for(const fraction of [1/3,2/3])marks.push({x,y:top+layout.cellHeight*fraction});
    }
  } else for(const p of placements) {
    if(!p)continue;
    const inset=Math.min(9,p.width/4);
    const x=layout.stapleSide==='right'?p.x+p.width-inset:p.x+inset;
    for(const fraction of [1/3,2/3])marks.push({x,y:p.y+p.height*fraction});
  }
  return marks;
}
export const stapleSize=3; // Half-length of each small crosshair, in points.
