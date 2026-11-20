"""Bake the six-pose Orchard atlases from the original WebP illustrations (Pillow and NumPy)."""
from pathlib import Path
from math import sin, cos, radians
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

art = Path(__file__).resolve().parents[1] / "orchard-survival" / "art"
families = {"staff": ("king", "guardian"), "mage": ("storm", "archmage"), "scout": ("ranger", "shadow")}
size = (400, 240)
scale = 1.6

def mask(points):
    m = Image.new("L", size)
    ImageDraw.Draw(m).polygon([(round(x*scale), round(y*scale)) for x,y in points], fill=255)
    return m.filter(ImageFilter.GaussianBlur(.5))

def panel(name, points):
    im = Image.open(art/(name+".webp")).convert("RGBA").crop((1200,0,1600,240))
    im.putalpha(ImageChops.multiply(im.getchannel("A"), mask(points)))
    return im

def anchored(im, origin, target, width, height, angle):
    # Inverse affine map keeps the collar and weapon socket attached in every pose.
    sx, sy = np.array(origin)*scale
    tx, ty = np.array(target)*scale
    c, s = cos(radians(angle)), sin(radians(angle))
    a,b,d,e = c/width, s/width, -s/height, c/height
    return im.transform(size, Image.Transform.AFFINE,
        (a,b,sx-a*tx-b*ty,d,e,sy-d*tx-e*ty), Image.Resampling.BICUBIC)

def tint(im, dark, light, amount):
    colors = ImageOps.colorize(ImageOps.grayscale(im), dark, light).convert("RGBA")
    colors.putalpha(im.getchannel("A"))
    return Image.blend(im, colors, amount)

mantles = {
    "king": ("king", [(28,71),(55,63),(70,65),(77,70),(90,72),(101,78),(91,83),(74,90),(60,100),(32,99)], (96,77)),
    "guardian": ("king", [(28,71),(55,63),(70,65),(77,70),(90,72),(101,78),(91,83),(74,90),(60,100),(32,99)], (96,77)),
    "storm": ("storm", [(37,72),(52,68),(73,67),(84,69),(95,68),(103,73),(92,79),(82,87),(69,94),(62,98),(57,94),(54,85),(45,80),(36,80)], (98,74)),
    "archmage": ("storm", [(37,72),(52,68),(73,67),(84,69),(95,68),(103,73),(92,79),(82,87),(69,94),(62,98),(57,94),(54,85),(45,80),(36,80)], (98,74)),
    "ranger": ("ranger", [(40,87),(63,81),(78,80),(89,78),(96,79),(90,89),(77,99),(59,112),(53,111),(52,104),(42,111),(39,106),(44,98),(39,98)], (92,81)),
    "shadow": ("shadow", [(30,81),(43,65),(61,60),(70,55),(85,64),(96,71),(91,79),(77,82),(62,82),(53,88),(49,85),(50,77),(35,84)], (92,73)),
}
collars = {"staff":[(89,68),(81,70),(76,65),(91,71)],
           "mage":[(79,66),(80,68),(79,65),(86,72)],
           "scout":[(93,69),(91,70),(90,65),(90,71)]}
tips = {"king": ("king",[(147,77),(158,73),(172,72),(181,78),(180,91),(163,93),(147,88)],(149,84),0),
        "guardian": ("guardian",[(141,79),(154,75),(158,63),(176,69),(190,80),(184,93),(159,101),(156,91),(140,89)],(144,84),0),
        "storm": ("storm",[(132,76),(148,69),(151,62),(173,52),(190,56),(186,91),(176,102),(149,93),(135,86)],(135,80),0),
        "archmage": ("archmage",[(127,77),(134,71),(133,52),(149,48),(157,44),(182,51),(182,68),(164,91),(149,100),(137,97),(144,88),(147,79),(130,84)],(129,80),-29)}
staff_end = [(159,80,-16),(146,84,-11),(149,79,-15),(206,74,-7)]
mage_end = [(125.5,64,-53),(131,73,-44),(127,69,-46),(170,69,-17)]
mage_head = [
    [(123,28),(159,25),(161,63),(129,68),(121,64),(121,47)],
    [(135,43),(166,43),(165,78),(132,78),(128,73),(130,62)],
    [(133,38),(162,39),(162,70),(128,74),(125,67),(126,58)],
    [(170,45),(202,43),(208,82),(171,85),(168,72),(168,57)]]
bow_parts = [[(130,78),(137,69),(143,29),(158,29),(157,60),(145,80),(139,85)],
             [(128,84),(139,67),(144,46),(160,43),(157,62),(148,81),(136,89)],
             [(130,80),(137,62),(149,40),(162,41),(156,69),(143,83),(136,87)],
             [(130,15),(151,24),(165,43),(170,65),(167,79),(173,90),(155,119),(150,121),(145,116),(160,94),(162,78),(157,72),(158,60),(149,44),(136,36),(130,30)]]
swatches = {"ranger":("#293d2c","#edca76"), "shadow":("#28203d","#b4bad6")}

def dress(base,job,route,tier,i):
    donor, points, origin = mantles[route]
    cloth = panel(donor,points)
    if route=="guardian": cloth=tint(cloth,"#163c34","#d5cc88",.90)
    if route=="archmage": cloth=tint(cloth,"#573455","#ffe098",.89)
    target=collars[job][i]
    # A resting cape hangs down and turns back in flight. Larger master capes
    # extend past the original silhouette, with the body, limbs and tail in front.
    angle=[-42,-4,10,6][i]
    w=(.72 if tier==2 else 1.04) * (1.12 if job!="staff" else 1)
    h=(.74 if tier==2 else 1.05)
    back=anchored(cloth,origin,target,w,h,angle)
    if job=="scout":
        altered=tint(base,*swatches[route],.82 if tier==3 else .58)
        base=Image.composite(altered,base,mask(bow_parts[i]))
    else:
        item, bounds, anchor, orientation=tips[route]
        weapon=panel(item,bounds)
        x,y,angle=(staff_end if job=="staff" else mage_end)[i]
        if job=="mage":
            base=base.copy()
            base.putalpha(ImageChops.subtract(base.getchannel("A"),mask(mage_head[i])))
            x -= 5*cos(radians(angle))
            y -= 5*sin(radians(angle))
        factor=(.57 if tier==2 else .77) if job=="staff" else (.64 if tier==2 else .83)
        base=Image.alpha_composite(base,anchored(weapon,anchor,(x,y),factor,factor,angle-orientation))
    return Image.alpha_composite(back,base)

def weight_shift(im,job,release):
    # Bend around the hips with planted feet. The upper section translates as a
    # unit to preserve the original face and both hands on the moving weapon.
    amount=({"staff":11,"mage":-7,"scout":-9} if release else {"staff":-9,"mage":6,"scout":5})[job]*scale
    dip=(1.6 if release else 5.5)*scale
    mesh=[]
    def source(x,y):
        weight=np.clip((213-y)/65,0,1)
        return (x-amount*weight,y-dip*weight)
    for y in range(0,240,8):
        y2=y+8
        mesh.append(((0,y,400,y2),(*source(0,y),*source(0,y2),*source(400,y2),*source(400,y))))
    return im.transform(size,Image.Transform.MESH,mesh,Image.Resampling.BICUBIC)

def released_arrow(im):
    # Release the drawn string and the protruding arrow. Only reconstruct the
    # narrow ink line using samples immediately on its two sides.
    im=im.copy()
    def lift_line(start,end,offset,width):
        line=Image.new("L",size)
        ImageDraw.Draw(line).line([start,end],fill=255,width=width)
        left=ImageChops.offset(im,*offset)
        right=ImageChops.offset(im,-offset[0],-offset[1])
        im.paste(Image.blend(left,right,.5),(0,0),line.filter(ImageFilter.GaussianBlur(.35)))
    lift_line((169,100),(214,37),(3,2),4)
    lift_line((168,116),(230,185),(-3,3),3)
    lift_line((174,103),(247,100),(0,4),4)
    tip=mask([(167,58),(193,56),(194,69),(167,69)])
    im.putalpha(ImageChops.subtract(im.getchannel("A"),tip))
    string=Image.new("RGBA",size)
    ImageDraw.Draw(string).line([(214,37),(220,99),(230,185)],fill=(94,72,46,215),width=1)
    im=Image.alpha_composite(im,string)
    return im

for job,routes in families.items():
    for route,tier in [(job,1)]+[(r,t) for r in routes for t in (2,3)]:
        path=art/((job if tier==1 else route+"-t"+str(tier))+".webp")
        raw=Image.open(path).convert("RGBA")
        frames=[raw.crop((i*400,0,(i+1)*400,240)) for i in range(4)]
        if tier>1: frames=[dress(frame,job,route,tier,i) for i,frame in enumerate(frames)]
        last=released_arrow(frames[3]) if job=="scout" else frames[3]
        frames.extend([weight_shift(frames[0],job,False),weight_shift(last,job,True)])
        strip=Image.new("RGBA",(2400,240))
        for i,frame in enumerate(frames): strip.paste(frame,(400*i,0))
        strip.save(art/(route+"-poses"+str(tier)+".webp"),quality=90,method=6,alpha_quality=100)
