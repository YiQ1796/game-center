"""Reassemble the battle clearing using the original painted paths and grass."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

art = Path(__file__).resolve().parents[1] / "orchard-survival" / "art"
original = Image.open(art/"orchard-floor.webp").convert("RGB")
w,h = original.size
def at(point):
    return tuple(round(v*s/n) for v,s,n in zip(point,(w,h),(520,347)))

# The three paths follow the paving in the source painting. A feathered margin
# retains its existing stonework while opening continuous lawns between groves.
paths = [
    ([(0,214),(65,199),(120,183),(166,189),(208,183),(246,158),(282,135),(337,118),(417,120),(520,109)],37),
    ([(56,-6),(71,24),(68,56),(72,83),(112,103),(129,124),(133,146),(118,175)],14),
    ([(393,130),(374,156),(365,191),(380,218),(419,240),(450,252),(478,280),(497,319),(515,349)],15)]
road=Image.new("L",(w,h))
draw=ImageDraw.Draw(road)
for points,width in paths:
    draw.line([at(p) for p in points],fill=255,width=round(width*w/520),joint="curve")
road=np.asarray(road.filter(ImageFilter.GaussianBlur(w*.009)),dtype=float)/255
yy,xx=np.mgrid[:h,:w]
u,v=xx/w,yy/h
edge=np.minimum(np.minimum(u,1-u),np.minimum(v,1-v))
rim=np.clip(1-edge/.115,0,1)**2
# Keep a handful of original orchard beds as landmarks instead of filling the
# entire field with fruit and flowers at the same contrast as the monsters.
beds=np.zeros_like(road)
for cx,cy,rx,ry in [(.12,.25,.11,.12),(.59,.07,.15,.13),(.86,.56,.115,.16),(.28,.90,.15,.15),(.56,.74,.09,.115)]:
    beds=np.maximum(beds,np.clip(1-((u-cx)/rx)**2-((v-cy)/ry)**2,0,1)**.82)
keep=np.maximum(road*.95,np.maximum(rim*.72,beds*.83))
rgb=np.asarray(original,dtype=float)
tone=np.asarray(original.filter(ImageFilter.GaussianBlur(w*.026)),dtype=float)
light=tone@np.array([.299,.587,.114])
# Mirror small swatches of brushwork across tile edges and mix at two scales.
def brush(box,factor):
    stamp=ImageOps.grayscale(original.crop((*at(box[:2]),*at(box[2:]))))
    stamp=stamp.resize((round(stamp.width*factor),round(stamp.height*factor)),Image.Resampling.BICUBIC)
    patch=np.asarray(stamp,dtype=float)-np.asarray(stamp.filter(ImageFilter.GaussianBlur(4)),dtype=float)
    patch=np.clip(patch,-18,18)
    patch=np.concatenate([patch,patch[:,::-1]],axis=1)
    patch=np.concatenate([patch,patch[::-1,:]],axis=0)
    dx=14*np.sin(yy/43)+17*np.sin((xx+yy)/115)
    dy=12*np.sin(xx/41)-19*np.cos((xx-yy)/97)
    return patch[(yy+dy).astype(int)%patch.shape[0],(xx+dx).astype(int)%patch.shape[1]]
grain=brush((332,248,356,266),1.23)*.37+brush((89,229,110,247),1.79)*.21
grass=np.array([135,151,90])+(light[...,None]-109)*np.array([.58,.55,.40])+grain[...,None]
# Retain long brush strokes and minor contours while softening bright specks.
medium=np.asarray(original.filter(ImageFilter.GaussianBlur(3)),dtype=float)
grass+=(medium-tone)*.11
source=rgb*.85+tone*.15
paint=grass*(1-keep[...,None])+source*keep[...,None]
Image.fromarray(np.uint8(np.clip(paint,0,255))).save(art/"orchard-meadow.webp",quality=88,method=6)
