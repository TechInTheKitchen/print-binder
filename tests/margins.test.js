import test from 'node:test';
import assert from 'node:assert/strict';
import {pixelBounds,sourceCrops} from '../src/margins.js';
import {makeLayout} from '../src/layout.js';
test('margin detection includes faint marks and ignores transparent pixels and blank pages',()=>{
  const width=20,height=20,data=new Uint8ClampedArray(width*height*4).fill(255);
  assert.equal(pixelBounds(data,width,height),null);
  const mark=(x,y,value,alpha=255)=>data.set([value,value,value,alpha],(y*width+x)*4);
  mark(8,7,0);mark(12,11,250);mark(0,0,0,0);
  assert.deepEqual(pixelBounds(data,width,height),{x:6,y:5,width:9,height:9});
  mark(19,19,0);assert.equal(pixelBounds(data,width,height).width,14);
});
const pages=[{width:600,height:800,contentBounds:{x:60,y:80,width:420,height:600}},{width:600,height:800,contentBounds:{x:90,y:60,width:440,height:620}},{width:600,height:800,contentBounds:null}];
test('shared crops retain all selected content, padding, and blank pages',()=>{
  assert.deepEqual(sourceCrops(pages,[0,1,2],true,10),[{x:50,y:50,width:490,height:640},{x:50,y:50,width:490,height:640},{x:0,y:0,width:600,height:800}]);
  assert.deepEqual(sourceCrops(pages,[0],true,0)[0],pages[0].contentBounds);
  assert.deepEqual(sourceCrops(pages,[0,1],true,0,false)[1],pages[1].contentBounds);
  assert.deepEqual(sourceCrops(pages,[0],false)[0],{x:0,y:0,width:600,height:800});
  assert.deepEqual(sourceCrops(pages,[0],true,72)[0],{x:0,y:8,width:552,height:744});
});
test('trimming increases physical text scale and does not change booklet order',()=>{
  const config={width:612,height:792,cols:2,rows:2,margin:18,gap:9,range:'1-2',mode:'booklet'};
  const full=makeLayout(config,pages),trimmed=makeLayout({...config,trimMargins:true,trimPadding:5},pages);
  assert.deepEqual(trimmed.sides,full.sides);assert.ok(trimmed.minScale>full.minScale);
  assert.equal(trimmed.trimmed,2);assert.ok(trimmed.removed>.3);
  for(const side of trimmed.placements)for(const p of side)if(p)assert.ok(p.x+p.width<=594&&p.y+p.height<=774);
  assert.throws(()=>makeLayout({...config,trimPadding:-1},pages));
});
