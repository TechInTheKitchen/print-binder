import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLayout} from '../src/layout.js';
import {addCover,coverTrimLines} from '../src/cover.js';
import {staplePoints} from '../src/staples.js';
const body={kind:'pdf',pages:Array.from({length:8},()=>({width:300,height:400}))};
const config={width:612,height:792,cols:2,rows:2,margin:18,gap:9,range:'',mode:'booklet',stapleMarks:true};
test('cover bleeds beyond cuts inside printer margins and preserves booklet sequence',()=>{
 const base=makeLayout(config,body.pages),cover={pages:[{width:800,height:800}]},result=addCover(base,body,cover,false);
 assert.equal(result.layout.sides.length,4);assert.deepEqual(result.layout.sides.slice(2),base.sides);
 assert.deepEqual(result.layout.sideTypes,['cover-front','cover-blank','body','body']);
 const p=result.layout.placements[0][0];assert.equal(p.x,27);assert.equal(p.y,27);assert.equal(p.width,558);assert.equal(p.height,738);assert.equal(p.crop.height,800);assert.ok(p.crop.x>0);
 const trim=result.layout.coverTrim;assert.equal(trim.x-p.x,9);assert.equal(trim.width,540);assert.equal(trim.height,720);
 const lines=coverTrimLines(result.layout,0);assert.equal(lines.length,8);assert.deepEqual(coverTrimLines(result.layout,1),[]);
 for(const line of lines){for(const x of [line.x1,line.x2])assert.ok(x>=18&&x<=594);for(const y of [line.y1,line.y2])assert.ok(y>=18&&y<=774);assert.ok(line.x2<27||line.x1>585||line.y2<27||line.y1>765);}
 assert.deepEqual(staplePoints(result.layout,0),[]);assert.deepEqual(staplePoints(result.layout,1),[]);assert.equal(result.source.pages.length,9);
});
test('two cover sides are retained and grid can omit an empty reverse',()=>{
 const base=makeLayout({...config,mode:'grid'},body.pages),page={width:612,height:792};
 const two=addCover(base,body,{pages:[page,page]});assert.equal(two.layout.coverSides,2);assert.deepEqual(two.layout.sideTypes.slice(0,2),['cover-front','cover-back']);
 const one=addCover(base,body,{pages:[page]},false);assert.equal(one.layout.coverSides,1);assert.ok(one.layout.placements[0][0].crop.width<612);
 assert.deepEqual(addCover(base,body,null),{layout:base,source:body});
});
test('custom cover margin and bleed remain independent of body placement',()=>{
 const base=makeLayout(config,body.pages),result=addCover(base,body,{pages:[{width:612,height:792}]},true,{margin:36,bleed:12});
 assert.equal(result.layout.placements[0][0].x,45);assert.equal(result.layout.coverTrim.x,57);
 assert.deepEqual(result.layout.placements.slice(2),base.placements);
 assert.throws(()=>addCover(base,body,{pages:[{width:612,height:792}]},true,{margin:300,bleed:20}),/no finished cover/);
});
