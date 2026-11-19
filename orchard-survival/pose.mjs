// Deform the existing illustrated character and everything it wears with one mesh.
// Weapon grips sample that same pose. All texture coordinates are in character space.
const SCALE=2, LEFT=-48, TOP=-94, WIDTH=96, HEIGHT=118;
const W=WIDTH*SCALE, H=HEIGHT*SCALE;
const xs=[-48,-32,-24,-18,-13,-8,-3,0,4,9,14,19,25,32,48];
const ys=[-94,-75,-58,-41,-32,-26,-20,-14,-9,-4,1,6,11,17,24];
const skins=new Map(), frames=new Map();
const smooth=(a,b,x)=>{const n=Math.max(0,Math.min(1,(x-a)/(b-a)));return n*n*(3-2*n);};
function remember(cache,key,value,limit){
  if(cache.size>=limit)cache.delete(cache.keys().next().value);
  cache.set(key,value);
  return value;
}
function canvas(){
  const c=document.createElement('canvas');c.width=W;c.height=H;return c;
}
function skinFor(key,paint){
  if(skins.has(key))return skins.get(key);
  const surface=canvas(), ctx=surface.getContext('2d',{willReadFrequently:true});
  ctx.setTransform(SCALE,0,0,SCALE,-LEFT*SCALE,-TOP*SCALE);
  paint(ctx);
  const image=ctx.getImageData(0,0,W,H);
  return remember(skins,key,new Uint32Array(image.data.buffer),10);
}
const framesByJob={
  staff:[0,.09,.25,.48,.72,.91,1,.78,.28,-.30,-.55,-.34,-.12],
  mage:[0,.07,.23,.5,.76,.96,1,.72,.39,-.2,-.43,-.28,-.1],
  scout:[0,.08,.22,.45,.7,.94,1,.8,.42,-.32,-.68,-.45,-.18]
};

export function poseFor(player,time){
  const walking=player.walk&&!player.down;
  const phase=walking?(Number.isFinite(player.gait)?player.gait/255:time*2):0;
  const step=Math.floor(phase*16)%16;
  const idle=walking?0:Math.floor(time*3)%8;
  const hit=player.down?0:Math.round((player.look?.swing||0)*.12);
  // Separate anticipation, extension and recovery even when the feet keep running.
  const a=(framesByJob[player.job]||framesByJob.staff)[hit]||0;
  const angle=step*Math.PI/8;
  const slope=walking?Math.sign(player.travelY||0):0;
  return {key:[walking?step:'i'+idle,hit,player.job,slope].join('/'),job:player.job,a,slope,
    stride:walking?Math.sin(angle):0, lift:walking?Math.cos(angle):0,
    bob:walking?-2.8*Math.abs(Math.sin(angle)):Math.sin(idle*Math.PI/4)*.55};
}
export function deform(x,y,p){
  const {a,job,stride,lift,bob,slope=0}=p;
  const upper=1-smooth(-30,5,y);
  const leg=smooth(-8,8,y);
  const right=smooth(-4,4,x)*2-1;
  const hand=smooth(7,16,Math.abs(x))*smooth(-29,-15,y)*(1-smooth(-7,2,y));
  const tail=smooth(13,24,x)*smooth(-15,0,y);
  const push=job==='staff'?9.2:job==='mage'?4.6:-5;
  const head=1-smooth(-39,-28,y);
  const tilt=head*(stride*.048+a*(job==='staff'?.15:job==='scout'?-.11:-.075));
  let dx=upper*(stride*1.5+a*push)+leg*(stride*right*(slope?3.8:5.6)-a*right*2.8);
  let dy=bob*(1-leg)+leg*(-Math.max(0,lift*right)*7.6+Math.min(0,lift*right)*.5);
  dx+=hand*(right*(job==='scout'?8.5:6.5)*a-stride*right*3);
  dy+=hand*(-Math.max(0,a)*(job==='mage'?15:job==='staff'?9:6)+stride*right*1.8);
  dy+=upper*(job==='mage'?-4*a:a*2.8)+tail*(stride*5-a*5);
  dx+=tail*(lift*3.2+a*2.2);
  // A planted foot supports the hip. Upper and lower body turn in opposite phases.
  const hips=smooth(-28,-12,y)*(1-smooth(-8,6,y));
  dx+=hips*(stride*2.2-a*(job==='staff'?4:2));
  dy+=leg*stride*right*slope*3.4+upper*slope*(1+Math.abs(stride)*.9);
  if(job==='scout')dy+=hand*right*a*2;
  return [x+dx-(y+30)*tilt,y+dy+x*tilt];
}
const vertices=ys.flatMap(y=>xs.map(x=>[x,y]));
const triangles=[];
for(let row=0;row<ys.length-1;row++)for(let col=0;col<xs.length-1;col++){
  const i=row*xs.length+col, j=i+xs.length;
  triangles.push([i,i+1,j],[j,i+1,j+1]);
}
function triangle(source,dest,points,ids){
  const [ia,ib,ic]=ids, [a,b,c]=[points[ia],points[ib],points[ic]];
  const ax=a[0],ay=a[1],bx=b[0]-ax,by=b[1]-ay,cx=c[0]-ax,cy=c[1]-ay;
  const det=bx*cy-by*cx;
  if(det<=.02)return;
  const minX=Math.max(0,Math.floor(Math.min(ax,b[0],c[0]))),maxX=Math.min(W-1,Math.ceil(Math.max(ax,b[0],c[0])));
  const minY=Math.max(0,Math.floor(Math.min(ay,b[1],c[1]))),maxY=Math.min(H-1,Math.ceil(Math.max(ay,b[1],c[1])));
  const src=vertices[ia],u0=(src[0]-LEFT)*SCALE,v0=(src[1]-TOP)*SCALE;
  const ub=(vertices[ib][0]-src[0])*SCALE,uc=(vertices[ic][0]-src[0])*SCALE;
  const vb=(vertices[ib][1]-src[1])*SCALE,vc=(vertices[ic][1]-src[1])*SCALE;
  for(let y=minY;y<=maxY;y++){
    const ry=y+.5-ay;
    let u=((minX+.5-ax)*cy-ry*cx)/det, v=(bx*ry-by*(minX+.5-ax))/det;
    for(let x=minX;x<=maxX;x++,u+=cy/det,v-=by/det){
      if(u<-.00001||v<-.00001||u+v>1.00001)continue;
      const sx=Math.min(W-1,Math.max(0,Math.floor(u0+ub*u+uc*v)));
      const sy=Math.min(H-1,Math.max(0,Math.floor(v0+vb*u+vc*v)));
      dest[y*W+x]=source[sy*W+sx];
    }
  }
}
export function drawPose(ctx,skinKey,pose,paint){
  const key=skinKey+'|'+pose.key;
  let frame=frames.get(key);
  if(!frame){
    const source=skinFor(skinKey,paint);
    frame=canvas();
    const out=frame.getContext('2d'),image=out.createImageData(W,H);
    const dest=new Uint32Array(image.data.buffer);
    const points=vertices.map(([x,y])=>{
      const [px,py]=deform(x,y,pose);return [(px-LEFT)*SCALE,(py-TOP)*SCALE];
    });
    for(const ids of triangles)triangle(source,dest,points,ids);
    out.putImageData(image,0,0);
    remember(frames,key,frame,64);
  }
  ctx.drawImage(frame,LEFT,TOP,WIDTH,HEIGHT);
}
