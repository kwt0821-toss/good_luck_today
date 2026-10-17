POST=[]
from pinkall import *
import math
GS=Image.open('gold.jpg').convert('RGB')
def rim(cv,c_dark,c_mid,c_light,width=1.0,glow=None):
    if glow:
        g=Image.new('RGBA',(CW,CH),(0,0,0,0)); ImageDraw.Draw(g).rounded_rectangle(WIN,R+10,outline=glow,width=int(34*width)); cv.alpha_composite(g.filter(ImageFilter.GaussianBlur(12)))
    r=Image.new('RGBA',(CW,CH),(0,0,0,0)); d=ImageDraw.Draw(r)
    for w,c in((int(26*width),c_dark),(int(21*width),c_mid),(int(13*width),c_light),(max(3,int(5*width)),c_dark)):
        d.rounded_rectangle((WIN[0]-w+3,WIN[1]-w+3,WIN[2]+w-3,WIN[3]+w-3),R+w,outline=c,width=w)
    cv.alpha_composite(r)
def lace(cv,col=(255,255,255,235),edge=(230,190,205,255),r=11):
    d=ImageDraw.Draw(cv); x0,y0,x1,y1=WIN
    for x in range(x0+40,x1-40,2*r):   # top & bottom scallops just inside window edge (stay opaque since drawn outside? -> drawn over rim band)
        for y,s in((y0-2,1),(y1+2,-1)):
            d.pieslice((x-r,y-r,x+r,y+r),0 if s==1 else 180,180 if s==1 else 360,fill=col,outline=edge)
def swag(cv,y,xa,xb,sag,n,pr=7,col=(250,246,255),edge=(205,185,215)):
    d=ImageDraw.Draw(cv)
    for i in range(n+1):
        t=i/n; x=xa+(xb-xa)*t; yy=y+sag*4*t*(1-t)
        d.ellipse((x-pr,yy-pr,x+pr,yy+pr),fill=col,outline=edge,width=2); d.ellipse((x-pr*.55,yy-pr*.6,x-pr*.05,yy-pr*.15),fill=(255,255,255))
def jewel(hue=None,size=110):
    p=GS.crop((8,8,132,132)).convert('RGBA')
    if hue is not None:
        a=np.asarray(p).copy(); hsv=cv2.cvtColor(a[...,:3],cv2.COLOR_RGB2HSV).astype(np.float32); h=hsv[...,0]*2
        pk=(((h>290)|(h<20))&(hsv[...,1]>40)).astype(np.float32); hsv[...,0]=hsv[...,0]*(1-pk)+(hue/2)*pk; a[...,:3]=cv2.cvtColor(hsv.astype(np.uint8),cv2.COLOR_HSV2RGB); p=Image.fromarray(a)
    m=Image.new('L',p.size,0); ImageDraw.Draw(m).ellipse((6,6,p.width-6,p.height-6),fill=255); p.putalpha(m.filter(ImageFilter.GaussianBlur(2)))
    return p.resize((size,size),Image.LANCZOS)
def sparkle(cv,pts,col=(255,250,225,255)):
    d=ImageDraw.Draw(cv)
    for x,y,s in pts:
        d.polygon([(x,y-s),(x+s*.22,y),(x,y+s),(x-s*.22,y)],fill=col); d.polygon([(x-s,y),(x,y-s*.22),(x+s,y),(x,y+s*.22)],fill=col)
def stars5(cv,cy=62):
    # 5 equal stars: center one on medallion crest
    for x,y in((CW//2,26),(CW//2-118,cy),(CW//2+118,cy),(CW//2-176,cy),(CW//2+176,cy)):
        cv.alpha_composite(STAR,(int(x-STAR.width/2),int(y-STAR.height/2)))
SP=[(170,300,14),(850,320,12),(160,1380,12),(860,1360,14),(300,120,10),(720,118,10),(150,700,9),(870,900,9)]
def build3(t):
    POST.clear(); cv=base().convert('RGBA')
    if t=='5star':
        ornate(cv); globals()['PLATE']=bigplate(cv)
        rim(cv,(150,95,40,255),(232,180,90,255),(255,232,170,255),1.0,glow=(255,215,150,200))
        POST.append(lambda c: swag(c,WIN[1]+4,WIN[0]+60,CW//2-60,50,11,pr=10,col=(255,252,246),edge=(214,170,110))); POST.append(lambda c: swag(c,WIN[1]+4,CW//2+60,WIN[2]-60,50,11,pr=10,col=(255,252,246),edge=(214,170,110)))
        j=jewel(None,92)
        POST.append(lambda c,j=j: [c.alpha_composite(j,(x-46,y-46)) for x,y in((WIN[0]-4,WIN[1]-4),(WIN[2]+4,WIN[1]-4),(WIN[0]-4,WIN[3]+4),(WIN[2]+4,WIN[3]+4))])
        stars5(cv); sparkle(cv,SP)
    elif t=='4star':
        simple(cv); cv=recolor(cv,158,.75,1.0)
        globals()['PLATE']=bigplate(cv,src=None) ; cv=recolor(cv,158,.75,1.0)
        rim(cv,(120,80,30,255),(225,175,85,255),(255,236,180,255),.9,glow=(170,255,220,190))
        gems(cv,160); j=jewel(160,84)
        POST.append(lambda c,j=j: [c.alpha_composite(j,(x-42,y-42)) for x,y in((WIN[0]-4,WIN[1]-4),(WIN[2]+4,WIN[1]-4),(WIN[0]-4,WIN[3]+4),(WIN[2]+4,WIN[3]+4))])
        POST.append(lambda c: swag(c,WIN[1]+4,WIN[0]+60,WIN[2]-60,64,22,pr=8,col=(255,255,250),edge=(120,190,160)))
        stars(cv,4,cy=78,side=60,gap=58); sparkle(cv,SP[:6])
    elif t=='meme':
        ornate(cv); globals()['PLATE']=bigplate(cv); cv=recolor(cv,52,1.05,1.04)
        rim(cv,(140,100,20,255),(240,200,80,255),(255,244,180,255),.7)
    elif t=='character':
        ornate(cv); globals()['PLATE']=bigplate(cv); cv=recolor(cv,262,.75,1.02); pearls(cv)
        rim(cv,(110,85,160,255),(200,180,240,255),(250,246,255,255),.7)
        POST.append(lambda c: swag(c,WIN[1]+4,WIN[0]+60,WIN[2]-60,50,26,pr=6))
    else:
        n=int(t[-1]); simple(cv); globals()['PLATE']=bigplate(cv); cv=recolor(cv,38,.62,1.0)
        if n>=2: rim(cv,(150,110,50,255),(220,185,120,255),(250,236,205,255),.6)
        if n>=3: sparkle(cv,SP[:4]); POST.append(lambda c: swag(c,WIN[1]+4,WIN[0]+60,WIN[2]-60,40,22,pr=5,col=(255,250,240),edge=(215,190,150)))
        stars(cv,n,cy=78,side=60,gap=58)
    return cv
if __name__=='__main__':
    for t in['basic-1','basic-2','basic-3','4star','5star','meme','character']:
        cv=build3(t).convert('RGBA'); mask=Image.new('L',(CW,CH),0); ImageDraw.Draw(mask).rounded_rectangle(WIN,R,fill=255); mask=mask.filter(ImageFilter.GaussianBlur(2.5))
        a=np.asarray(cv).copy(); a[...,3]=np.minimum(a[...,3],255-np.asarray(mask)); cv=Image.fromarray(a)
        for f in POST: f(cv)
        cv.save('v3-'+t+'-raw.png')
