import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLayout} from '../src/layout.js';
import {staplePoints} from '../src/staples.js';
const config={width:612,height:792,cols:2,rows:2,margin:18,gap:20,rowGap:30,range:'',mode:'grid',edgeToEdge:true,pageScale:75,enlarge:false};
const pages=Array.from({length:4},()=>({width:420,height:298}));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('scaled grid pages meet along both edges while spare space stays outside',()=>{
 const l=makeLayout(config,pages),p=l.placements[0];assert.equal(l.gap,0);assert.equal(l.rowGap,0);
 close(p[0].x+p[0].width,p[1].x);close(p[0].y+p[0].height,p[2].y);close(p[1].y+p[1].height,p[3].y);
 close(p[0].x,612-p[1].x-p[1].width);assert.ok(p[0].y>18);assert.deepEqual(p[0].crop,{x:0,y:0,width:420,height:298});
});
test('passport A6-sized pages touch the horizontal seam without enlargement or flipping',()=>{
 const l=makeLayout({...config,cols:1,mode:'passport',passportActualSize:true,stapleMarks:true},pages);
 for(const p of l.placements){close(p[0].y+p[0].height,p[1].y);for(const page of p){assert.equal(page.scale,1);assert.equal(page.turn180,false);}}
 for(const mark of staplePoints(l,0))close(mark.y,l.placements[0][1].y);
});
test('mixed source shapes crop to matching tiles and report the crop',()=>{
 const l=makeLayout(config,[pages[0],{width:200,height:500},pages[2],pages[3]]);
 close(l.placements[0][0].width,l.placements[0][1].width);close(l.placements[0][0].height,l.placements[0][1].height);
 assert.ok(l.placements[0][1].crop.height<500);assert.ok(l.warnings.some(w=>w.includes('Some edges are cropped')));
});
