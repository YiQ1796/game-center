
// Reuse the hand-authored outlines at every scale.
const paths=new Map();
export function ink(c, outline, fill, edge='', weight=1.2) {
  let shape=paths.get(outline);
  if(!shape){shape=new Path2D(outline);paths.set(outline,shape);}
  if(fill){c.fillStyle=fill;c.fill(shape);}
  if(edge){c.lineWidth=weight;c.lineJoin='round';c.lineCap='round';c.strokeStyle=edge;c.stroke(shape);}
}
export function oval(c,x,y,rx,ry,color,rotation=0) {
  c.beginPath();c.ellipse(x,y,Math.max(.05,rx),Math.max(.05,ry),rotation,0,2*Math.PI);
  c.fillStyle=color;c.fill();
}
export function blend(c,x1,y1,x2,y2,...stops) {
  const g=c.createLinearGradient(x1,y1,x2,y2);
  stops.forEach((color,i)=>g.addColorStop(i/(stops.length-1),color));
  return g;
}
export function glow(c,x,y,r,inner,outer) {
  if(r<=.1)return;
  const g=c.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,inner);g.addColorStop(1,outer);
  c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);
}
export function star(c,x,y,r,color,angle=0) {
  c.save();c.translate(x,y);c.rotate(angle);c.scale(r,r);
  ink(c,'M0 -1 Q.08 -.13 .72 0 Q.1 .1 0 1 Q-.1 .1 -.72 0 Q-.1 -.1 0 -1Z',color);
  c.restore();
}
export function stroke(c,points,color,width) {
  c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1)) c.lineTo(...p);
  c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();
}
export const TAU=2*Math.PI;
