// Visible content bounds, in the displayed page's top-left point coordinates.
// Include faint marks, borders, and footers; never trim blank pages.
export function pixelBounds(data,width,height) {
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const i=(y*width+x)*4,a=data[i+3]/255;
    if(a&&(255-(255-data[i])*a<252||255-(255-data[i+1])*a<252||255-(255-data[i+2])*a<252)) {
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
  }
  if(right<0)return null;
  left=Math.max(0,left-2);top=Math.max(0,top-2);
  right=Math.min(width,right+3);bottom=Math.min(height,bottom+3);
  return {x:left,y:top,width:right-left,height:bottom-top};
}
export function detectMargins(canvas,pageWidth,pageHeight) {
  let sample=canvas;
  if(Math.max(canvas.width,canvas.height)>1000) {
    sample=document.createElement('canvas');const scale=1000/Math.max(canvas.width,canvas.height);
    sample.width=Math.max(1,Math.round(canvas.width*scale));sample.height=Math.max(1,Math.round(canvas.height*scale));sample.getContext('2d').drawImage(canvas,0,0,sample.width,sample.height);
  }
  const bounds=pixelBounds(sample.getContext('2d',{willReadFrequently:true}).getImageData(0,0,sample.width,sample.height).data,sample.width,sample.height);
  return bounds?{x:bounds.x/sample.width*pageWidth,y:bounds.y/sample.height*pageHeight,width:bounds.width/sample.width*pageWidth,height:bounds.height/sample.height*pageHeight}:null;
}
export function sourceCrops(pages,indices,trim,padding=4.32,consistent=true) {
  const groups=new Map();
  for(const index of new Set(indices)) {
    const p=pages[index],b=p.contentBounds;if(!b)continue;
    const key=`${p.width.toFixed(2)}:${p.height.toFixed(2)}`,old=groups.get(key);
    groups.set(key,old?{x:Math.min(old.x,b.x),y:Math.min(old.y,b.y),right:Math.max(old.right,b.x+b.width),bottom:Math.max(old.bottom,b.y+b.height)}:{x:b.x,y:b.y,right:b.x+b.width,bottom:b.y+b.height});
  }
  return pages.map(p=>{
    const full={x:0,y:0,width:p.width,height:p.height};if(!trim||!p.contentBounds)return full;
    const b=consistent?groups.get(`${p.width.toFixed(2)}:${p.height.toFixed(2)}`):null;
    const bounds=b?{x:b.x,y:b.y,width:b.right-b.x,height:b.bottom-b.y}:p.contentBounds;
    const x=Math.max(0,bounds.x-padding),y=Math.max(0,bounds.y-padding),right=Math.min(p.width,bounds.x+bounds.width+padding),bottom=Math.min(p.height,bounds.y+bounds.height+padding);
    return {x,y,width:right-x,height:bottom-y};
  });
}
