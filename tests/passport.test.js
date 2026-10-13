import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLayout} from '../src/layout.js';
import {addCover} from '../src/cover.js';
import {staplePoints} from '../src/staples.js';
const pages=Array.from({length:8},()=>({width:600,height:400}));
const config={width:612,height:792,cols:1,rows:2,margin:18,gap:9,rowGap:9,range:'',mode:'passport',stapleMarks:true};
test('passport keeps both pages upright and staples on the horizontal seam',()=>{
 const l=makeLayout(config,pages);assert.deepEqual(l.sides,[[7,0],[1,6],[5,2],[3,4]]);
 for(const side of l.placements)for(const p of side){assert.equal(p.turn180,false);assert.equal(p.rotate,false);assert.ok(p.width>p.height);}
 const marks=staplePoints(l,0);assert.equal(marks.length,2);assert.equal(marks[0].y,396);assert.equal(marks[1].y,396);
});
test('passport does not rotate source artwork even when rotation is enabled',()=>{
 const l=makeLayout({...config,rotate:true,forceRotate:true},[{width:400,height:600}]);
 for(const p of l.placements.flat().filter(Boolean)){assert.equal(p.rotate,false);assert.equal(p.turn180,false);assert.ok(p.height>p.width);}
});
test('22-page passport keeps covers outside with no blank pages in the signature',()=>{
 const p=Array.from({length:22},()=>({width:419.555906,height:297.637795}));
 const l=makeLayout({...config,passportIncludesCovers:true,passportActualSize:true},p);
 assert.equal(l.sides.length,12);assert.deepEqual(l.sides[0],[21,0]);assert.deepEqual(l.sides[1],[1,20]);assert.equal(l.blank,2);
 assert.deepEqual(l.sides.slice(-2),[[null,10],[11,null]]);
 // Simulate reading the nested booklet: outer-to-inner rectos, then
 // inner-to-outer versos, with the duplex side's opposing slot upright.
 const first=[],second=[];
 for(let i=0;i<l.sides.length;i+=2){first.push(l.sides[i][1],l.sides[i+1][0]);second.unshift(l.sides[i+1][1],l.sides[i][0]);assert.equal(l.placements[i][1]?.turn180,false);assert.equal(l.placements[i+1][0]?.turn180,false);}
 assert.deepEqual([...first,...second].filter(i=>i!==null),Array.from({length:22},(_,i)=>i));
 for(const side of l.placements)for(const page of side.filter(Boolean))assert.equal(page.scale,1);
});
test('multi-column passports retain nesting order and discard empty final columns',()=>{
 const l=makeLayout({...config,cols:2},pages);assert.deepEqual(l.sides,[[7,5,0,2],[1,3,6,4]]);
 const padded=makeLayout(config,pages.slice(0,5));assert.equal(padded.sides.length,4);assert.equal(padded.blank,3);
 assert.throws(()=>makeLayout({...config,rows:3},pages),/2 rows/);
 const twenty=makeLayout({...config,cols:2},Array.from({length:20},()=>({width:600,height:400})));
 assert.deepEqual(twenty.sides.slice(-2),[[11,null,8,null],[9,null,10,null]]);
 assert.equal(staplePoints(twenty,twenty.sides.length-1).length,2);
});
test('portrait covers have their own sheet size and reserve the passport reverse',()=>{
 const body={pages},l=makeLayout({...config,width:792,height:612},pages);
 const r=addCover(l,body,{pages:[{width:612,height:792}]},false);
 assert.deepEqual(r.layout.pageSizes[0],{width:612,height:792});assert.deepEqual(r.layout.pageSizes[2],{width:792,height:612});
 assert.equal(r.layout.sideTypes[1],'cover-blank');assert.deepEqual(r.layout.sides.slice(2),l.sides);
});
test('even-length signatures contain every page in reading order with only disposable blank cells',()=>{
 for(const count of [2,6,10,14,18,22,24,26,30])for(const cols of [1,2,3,4]){
  const l=makeLayout({...config,cols},Array.from({length:count},()=>({width:600,height:400}))),first=[],last=[];
  for(let i=0;i<l.sides.length;i+=2)for(let c=0;c<cols;c++){
   const front=l.sides[i],back=l.sides[i+1];
   if(front[cols+c]===null)continue;
   first.push(front[cols+c],back[c]);
   if(front[c]!==null){assert.notEqual(back[cols+c],null);last.unshift(back[cols+c],front[c]);}
   else assert.equal(back[cols+c],null);
  }
  assert.deepEqual([...first,...last],Array.from({length:count},(_,i)=>i));
 }
});
