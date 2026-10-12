import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLayout} from '../src/layout.js';
import {staplePoints} from '../src/staples.js';
const pages=Array.from({length:8},()=>({width:300,height:400}));
const config={width:612,height:792,cols:2,rows:2,margin:18,gap:12,rowGap:24,range:'',mode:'grid',rotate:false};
test('grid staple marks follow each occupied mini-page on the selected side',()=>{
 const left=makeLayout({...config,stapleMarks:true,range:'1-3',pageScale:75,alignX:'right'},pages),marks=staplePoints(left,0);
 assert.equal(marks.length,6);
 left.placements[0].filter(Boolean).forEach((p,i)=>{assert.equal(marks[i*2].x,p.x+9);assert.equal(marks[i*2].y,p.y+p.height/3);});
 const right={...left,stapleSide:'right'};
 left.placements[0].filter(Boolean).forEach((p,i)=>assert.equal(staplePoints(right,0)[i*2].x,p.x+p.width-9));
 assert.deepEqual(staplePoints({...left,stapleMarks:false},0),[]);
});
test('booklet marks stay on the shared fold seam on both sides',()=>{
 const layout=makeLayout({...config,mode:'booklet',stapleMarks:true,stapleSide:'right'},pages);
 assert.deepEqual(staplePoints(layout,0),staplePoints(layout,1));
 assert.equal(staplePoints(layout,0).length,4);
 for(const mark of staplePoints(layout,0))assert.equal(mark.x,306);
 assert.equal(staplePoints(layout,0)[2].y,18+layout.cellHeight+24+layout.cellHeight/3);
});
