from comp import *
import cv2, json, colorsys
S0=Image.open('pink.jpg').convert('RGB'); CW,CH=1020,1587
# --- inpaint printed stars from source
a=np.asarray(S0).copy(); m=np.zeros(a.shape[:2],np.uint8)
for x0,y0,x1,y1 in((450,33,507,95),(503,28,560,90),(720,28,776,90),(770,33,827,95)): m[y0:y1,x0:x1]=255
star_src=a[28:90,503:560].copy()
clean=cv2.inpaint(a,m,6,cv2.INPAINT_TELEA); S=Image.fromarray(clean)
d=np.abs(star_src.astype(int)-clean[28:90,503:560].astype(int)).sum(2)
al=np.clip((d-25)*4,0,255).astype(np.uint8); al=cv2.GaussianBlur(al,(3,3),0)
STAR=Image.fromarray(np.dstack([star_src,al]),'RGBA')
def col(xs):
    c=Image.new('RGB',(135,CH))
    for (x0,x1),(y0,y1) in zip([(0,62),(62,100),(100,135)],[(470,490),(300,345),(289,309)]):
        A,B=(x0,x1) if xs==0 else (1280-x1,1280-x0)
        c.paste(vtile(S,(A,y0,B,y1),CH),(x0 if xs==0 else 135-x1,0))
    return c
def base():
    cv=paper(S,(300,250,980,520),CW,CH); cv.paste(col(0),(0,0)); cv.paste(col(1),(CW-135,0)); return cv
def stars(cv,n,cy=62,cx=CW//2,gap=58,side=118):
    pts=[]
    if n%2: pts.append((cx,10+22)) if n>0 else None
    k=n//2
    for i in range(k): pts+= [(cx-side-i*gap,cy),(cx+side+i*gap,cy)]
    for x,y in pts:
        s=STAR if (x,y)!=(cx,32) else STAR.resize((48,52))
        cv.alpha_composite(s,(int(x-s.width/2),int(y-s.height/2)))
def ornate(cv,moons=True,bows=True):
    mid=CH//2
    if moons:
        put(cv,S,(0,320,135,430),(0,mid-55),{'t':20,'b':20}); put(cv,S,(1145,320,1280,430),(CW-135,mid-55),{'t':20,'b':20})
    put(cv,S,(0,0,300,310),(0,0),{'r':30,'b':40}); put(cv,S,(980,0,1280,310),(CW-300,0),{'l':30,'b':40})
    put(cv,S,(380,0,900,250),(CW//2-260,0),{'l':40,'r':40,'b':20})
    put(cv,S,(0,480,300,720),(0,CH-240),{'r':30,'t':40}); put(cv,S,(980,480,1280,720),(CW-300,CH-240),{'l':30,'t':40})
    put(cv,S,(320,560,940,720),(CW//2-310,CH-160),{'l':40,'r':40,'t':30})
def simple(cv):
    # rails: rotate side column for top/bottom
    top=col(0).rotate(-90,expand=True).crop((0,0,CW,135)); top=ImageOps.mirror(top)
    cv.paste(top,(0,0)); cv.paste(ImageOps.flip(top),(0,CH-135))
    cv.paste(col(0).crop((0,0,135,CH)),(0,0)); cv.paste(col(1),(CW-135,0))
    for (bx,flipx,flipy) in(((0,0,135,135),0,0),):
        pass
    c=S.crop((0,0,140,140)); m=feather(140,140,{'r':18,'b':18})
    cv.paste(c,(0,0),m); cv.paste(ImageOps.mirror(c),(CW-140,0),ImageOps.mirror(m)); cv.paste(ImageOps.flip(c),(0,CH-140),ImageOps.flip(m)); cv.paste(ImageOps.flip(ImageOps.mirror(c)),(CW-140,CH-140),ImageOps.flip(ImageOps.mirror(m)))
    put(cv,S,(395,140,885,250),(CW//2-245,140),{'l':25,'r':25,'t':8,'b':15})
    put(cv,S,(330,590,930,712),(CW//2-300,CH-150),{'l':40,'r':40,'t':25})
def recolor(img,hue,satk,valk=1.0,keep_gold=True):
    a=np.asarray(img.convert('RGBA')).astype(np.float32)/255; rgb=a[...,:3]
    hsv=cv2.cvtColor((rgb*255).astype(np.uint8),cv2.COLOR_RGB2HSV).astype(np.float32)
    h=hsv[...,0]*2; s=hsv[...,1]/255; v=hsv[...,2]/255
    pinkish=((h>290)|(h<22)).astype(np.float32)
    gold=((h>=25)&(h<=60)&(s>.25)).astype(np.float32)
    w=pinkish*(1-gold) if keep_gold else pinkish
    w=cv2.GaussianBlur(w,(5,5),0)
    nh=h*(1-w)+hue*w; ns=s*(1-w)+np.clip(s*satk,0,1)*w; nv=v*(1-w)+np.clip(v*valk,0,1)*w
    out=cv2.cvtColor(np.dstack([nh/2,ns*255,nv*255]).astype(np.uint8),cv2.COLOR_HSV2RGB)
    return Image.fromarray(np.dstack([out,(a[...,3]*255).astype(np.uint8)]),'RGBA')
def pearls(cv):
    d=ImageDraw.Draw(cv)
    def pearl(x,y,r=9):
        d.ellipse((x-r,y-r,x+r,y+r),fill=(246,240,255),outline=(190,170,230),width=2); d.ellipse((x-r*.5,y-r*.6,x-r*.05,y-r*.15),fill=(255,255,255))
    for y in range(170,CH-170,30): pearl(118,y); pearl(CW-118,y)
    for x in range(170,CW-170,30):
        if abs(x-CW//2)>270: pearl(x,118)
        if abs(x-CW//2)>320: pearl(x,CH-118)
def gems(cv,hue):
    G=Image.open('gold.jpg').convert('RGB').crop((5,318,135,415)).convert('RGBA')
    G=recolor_gem(G,hue); mid=CH//2
    mm=Image.new('L',G.size,0); ImageDraw.Draw(mm).ellipse((14,4,G.width-14,G.height-4),fill=255); m=mm.filter(ImageFilter.GaussianBlur(3))
    for x,flip in((0,0),(CW-G.width,1)):
        g=ImageOps.mirror(G) if flip else G; cv.paste(g,(x+2 if not flip else x-2,mid-G.height//2),m); cv.paste(g,(CW//2-G.width//2-0,10-200),m) if False else None
def recolor_gem(G,hue):
    a=np.asarray(G).copy(); hsv=cv2.cvtColor(a[...,:3],cv2.COLOR_RGB2HSV).astype(np.float32); h=hsv[...,0]*2
    blue=((h>200)&(h<280)).astype(np.float32); hsv[...,0]=(hsv[...,0]*(1-blue)+(hue/2)*blue); a[...,:3]=cv2.cvtColor(hsv.astype(np.uint8),cv2.COLOR_HSV2RGB); return Image.fromarray(a)
WIN=(128,282,CW-128,1448); R=34
def bigplate(cv,src=None,box=(403,143,872,234),k=1.25,y=128,r=22):
    src=src or S; p=src.crop(box); p=p.resize((int(p.width*k),int(p.height*k)),Image.LANCZOS).convert('RGBA')
    m=Image.new('L',p.size,0); ImageDraw.Draw(m).rounded_rectangle((2,2,p.width-2,p.height-2),r,fill=255); p.putalpha(m.filter(ImageFilter.GaussianBlur(1.5)))
    x=CW//2-p.width//2; cv.alpha_composite(p,(x,y)); return (x,y,p.width,p.height)
def finalize(cv,name):
    cv=cv.convert('RGBA'); mask=Image.new('L',(CW,CH),0); ImageDraw.Draw(mask).rounded_rectangle(WIN,R,fill=255); mask=mask.filter(ImageFilter.GaussianBlur(2.5))
    a=np.asarray(cv).copy(); a[...,3]=np.minimum(a[...,3],255-np.asarray(mask)); Image.fromarray(a).save(f'{name}-raw.png')
TIERS={}
def build(tier):
    cv=base().convert('RGBA')
    if tier in('5star','meme','character'):
        ornate(cv); stars(cv,{'5star':5,'meme':0,'character':0}[tier]) if tier=='5star' else None
    else:
        simple(cv)
    global PLATE; PLATE=bigplate(cv)
    return cv
