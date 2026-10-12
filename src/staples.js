// Coordinates are in output-sheet points, measured from the top left.
export function staplePoints(layout,side) {
  if(!layout.stapleMarks)return [];
  if(layout.sideTypes?.[side]?.startsWith('cover'))return [];
  const marks=[],placements=layout.placements[side];
  if(layout.mode==='booklet') {
    const x=layout.margin+layout.cellWidth+layout.gap/2;
    for(let row=0;row<layout.rows;row++) {
      if(!placements.slice(row*2,row*2+2).some(Boolean))continue;
      const top=layout.margin+row*(layout.cellHeight+layout.rowGap);
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
