import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLayout} from '../src/layout.js';
import {addCover} from '../src/cover.js';
import {staplePoints} from '../src/staples.js';
const pages=Array.from({length:8},()=>({width:600,height:400}));
const config={width:612,height:792,cols:1,rows:2,margin:18,gap:9,rowGap:9,range:'',mode:'passport',stapleMarks:true};
test('passport sheets pair landscape pages and invert the upper half for folding',()=>{
 const l=makeLayout(config,pages);assert.deepEqual(l.sides,[[7,0],[1,6],[5,2],[3,4]]);
 for(const side of l.placements){assert.ok(side[0].turn180);assert.equal(side[1].turn180,false);for(const p of side)assert.ok(p.width>p.height);}
 const marks=staplePoints(l,0);assert.equal(marks.length,2);assert.equal(marks[0].y,396);assert.equal(marks[1].y,396);
});
test('multi-column passports retain nesting order, pad duplex sheets, and reject wrong row count',()=>{
 const l=makeLayout({...config,cols:2},pages);assert.deepEqual(l.sides,[[7,5,0,2],[1,3,6,4]]);
 const padded=makeLayout(config,pages.slice(0,5));assert.equal(padded.sides.length,4);assert.equal(padded.blank,3);
 assert.throws(()=>makeLayout({...config,rows:3},pages),/2 rows/);
});
test('portrait covers have their own sheet size and reserve the passport reverse',()=>{
 const body={pages},l=makeLayout({...config,width:792,height:612},pages);
 const r=addCover(l,body,{pages:[{width:612,height:792}]},false);
 assert.deepEqual(r.layout.pageSizes[0],{width:612,height:792});assert.deepEqual(r.layout.pageSizes[2],{width:792,height:612});
 assert.equal(r.layout.sideTypes[1],'cover-blank');assert.deepEqual(r.layout.sides.slice(2),l.sides);
});
