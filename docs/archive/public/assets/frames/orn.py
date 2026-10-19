from PIL import Image,ImageDraw,ImageFilter
import numpy as np, math
def sphere(r,base,hi=(255,255,255),shadow=0.72):
    n=2*r+4; yy,xx=np.mgrid[0:n,0:n]-n/2+.5; d=np.sqrt(xx**2+yy**2)/r
    a=np.clip((1-d)*r*1.2,0,1)
    lx,ly=-.38,-.42; z=np.sqrt(np.clip(1-(xx/r)**2-(yy/r)**2,0,1)); dot=np.clip((xx/r)*lx+(yy/r)*ly+z*.83,0,1)
    b=np.array(base,float); col=b*(shadow+(1-shadow)*dot[...,None])
    spec=np.clip((dot-.86)/.14,0,1)[...,None]**2; col=col*(1-spec)+np.array(hi)*spec
    rim=np.clip((d-.82)/.18,0,1)[...,None]*.25; col=col*(1-rim)
    return Image.fromarray(np.dstack([col.clip(0,255),a*255]).astype(np.uint8),'RGBA')
def pearl_string(cv,y,xa,xb,sag,n,r=9,base=(250,244,238)):
    s=sphere(r,base)
    for i in range(n+1):
        t=i/n; x=xa+(xb-xa)*t; yy=y+sag*4*t*(1-t); cv.alpha_composite(s,(int(x-s.width/2),int(yy-s.height/2)))
def bead_line(cv,pts,r,base):
    s=sphere(r,base)
    for x,y in pts: cv.alpha_composite(s,(int(x-s.width/2),int(y-s.height/2)))
def facet_gem(kind,size,c,dark,light):
    S=size*4; im=Image.new('RGBA',(S,S),(0,0,0,0)); d=ImageDraw.Draw(im); m=S/2
    if kind=='diamond': out=[(m,4),(S-4,m),(m,S-4),(4,m)]
    elif kind=='octagon':
        k=S*.28; out=[(k,4),(S-k,4),(S-4,k),(S-4,S-k),(S-k,S-4),(k,S-4),(4,S-k),(4,k)]
    elif kind=='heart':
        out=[]
        for i in range(60):
            t=i/60*2*math.pi; x=16*math.sin(t)**3; y=-(13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t)); out.append((m+x*S/36,m+y*S/36+S*.04))
    elif kind=='drop':
        out=[(m+math.sin(t)*S*.32*(1-math.cos(t))/1.6*1.6 if False else m+S*.3*math.sin(t)*(1 if t<math.pi else 1), 0) for t in [0]]
        out=[]
        for i in range(60):
            t=i/60*2*math.pi; x=math.sin(t)*math.sin(t/2)**1.2; y=-math.cos(t); out.append((m+x*S*.38,m+y*S*.46))
    else:
        out=[(m+S*.46*math.cos(i/40*2*math.pi),m+S*.46*math.sin(i/40*2*math.pi)) for i in range(40)]
    gold=(200,150,60,255)
    d.polygon(out,fill=gold); # setting
    sc=.78; inner=[(m+(x-m)*sc,m+(y-m)*sc) for x,y in out]
    d.polygon(inner,fill=c)
    for i in range(len(inner)):  # facets
        x1,y1=inner[i]; x2,y2=inner[(i+1)%len(inner)]
        f=light if (i%2==0) else dark
        if kind in('diamond','octagon') or i%6==0:
            d.polygon([(m,m),(x1,y1),(x2,y2)],fill=f+(255,) if len(f)==3 else f)
    tab=[(m+(x-m)*.42,m+(y-m)*.42) for x,y in out]; d.polygon(tab,fill=c)
    d.ellipse((m-S*.22,m-S*.3,m-S*.05,m-S*.18),fill=(255,255,255,220))
    d.line(out+[out[0]],fill=(120,80,25,255),width=max(2,S//40))
    return im.resize((size,size),Image.LANCZOS)
def wing(size,flip=False,stroke=(200,150,60,255)):
    W,H=int(size*1.6),int(size*1.4); S=3; im=Image.new('RGBA',(W*S,H*S),(0,0,0,0)); d=ImageDraw.Draw(im)
    bx,by=W*S*.95,H*S*.86
    for i in range(6):
        L=W*S*(0.52+i*.07); ang=math.radians(250-i*13); rw=H*S*.095
        pts=[]
        for k in range(40):
            t=k/40*2*math.pi; ex=L/2+L/2*math.cos(t); ey=rw*math.sin(t)*(1-.35*math.cos(t))
            pts.append((bx+ex*math.cos(ang)-ey*math.sin(ang),by+ex*math.sin(ang)+ey*math.cos(ang)))
        d.polygon(pts,fill=(255,252,246,255),outline=stroke,width=7)
    d.ellipse((bx-H*S*.11,by-H*S*.11,bx+H*S*.09,by+H*S*.09),fill=(255,252,246,255),outline=stroke,width=7)
    im=im.resize((W,H),Image.LANCZOS)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
def crown(w,gem_c,gem_d,gem_l):
    h=int(w*.62); S=4; im=Image.new('RGBA',(w*S,h*S),(0,0,0,0)); d=ImageDraw.Draw(im); W,H=w*S,h*S
    pts=[(W*.06,H*.95),(W*.02,H*.28),(W*.27,H*.55),(W*.5,H*.05),(W*.73,H*.55),(W*.98,H*.28),(W*.94,H*.95)]
    d.polygon(pts,fill=(232,182,80,255),outline=(130,85,25,255),width=10)
    d.rectangle((W*.06,H*.78,W*.94,H*.97),fill=(214,160,60,255),outline=(130,85,25,255),width=10)
    d.polygon([(W*.1,H*.82),(W*.9,H*.82),(W*.9,H*.86),(W*.1,H*.86)],fill=(255,236,170,255))
    for x,y in((W*.02,H*.28),(W*.5,H*.05),(W*.98,H*.28)): d.ellipse((x-H*.08,y-H*.08,x+H*.08,y+H*.08),fill=(255,250,236,255),outline=(130,85,25,255),width=6)
    im=im.resize((w,h),Image.LANCZOS); g=facet_gem('octagon',int(w*.26),gem_c,gem_d,gem_l); im.alpha_composite(g,(w//2-g.width//2,int(h*.5)))
    for fx in(.27,.73):
        s=sphere(max(4,int(w*.045)),(250,244,238)); im.alpha_composite(s,(int(w*fx-s.width/2),int(h*.87-s.height/2)))
    return im
def tassel(cv,x,y,L,gem):
    for i in range(int(L/14)): 
        s=sphere(5,(235,190,95)); cv.alpha_composite(s,(int(x-s.width/2),int(y+i*14-s.height/2)))
    cv.alpha_composite(gem,(int(x-gem.width/2),int(y+L)))
def heart(cv,x,y,s,c):
    d=ImageDraw.Draw(cv); pts=[]
    for i in range(50):
        t=i/50*2*math.pi; pts.append((x+16*math.sin(t)**3*s/18,y-(13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t))*s/18))
    d.polygon(pts,fill=c)
def lace(cv,x0,x1,y,r,down=True,col=(255,252,250,240),edge=(225,190,150,255)):
    d=ImageDraw.Draw(cv)
    for x in range(int(x0),int(x1),2*r):
        box=(x,y-r,x+2*r,y+r)
        d.pieslice(box,0 if down else 180,180 if down else 360,fill=col,outline=edge,width=2)
        d.ellipse((x+r-2.5,y+(r*.45 if down else -r*.45)-2.5,x+r+2.5,y+(r*.45 if down else -r*.45)+2.5),fill=edge)
