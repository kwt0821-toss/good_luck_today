from PIL import Image,ImageFilter,ImageDraw
import numpy as np, random, math
O='/home/box/agent-data/agents/ebad8054-3dc9-4a3d-b66a-3964321b2a05/assets/frames-v5/'
for t in['basic-1','basic-2']:
    im=Image.open(f'v5-{t}-raw.png')
    for (w,h),suf in(((900,1400),''),((1350,2100),'@2x')):
        r=im.resize((w,h),Image.LANCZOS)
        if suf: r=r.filter(ImageFilter.UnsharpMask(1.2,60,2))
        r.save(O+f'frame-{t}{suf}.webp',quality=90,method=6)
def heart(d,x,y,s,f): d.polygon([(x+16*math.sin(t)**3*s/18,y-(13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t))*s/18) for t in [i/40*2*math.pi for i in range(40)]],fill=f)
for t,c0,c1 in(('1star',(255,249,240),(236,214,190)),('2star',(244,250,255),(186,214,244))):
    W,H=900,1400; yy,xx=np.mgrid[0:H,0:W]; r=np.sqrt(((xx-W/2)/(W*.6))**2+((yy-H*.5)/(H*.55))**2); tt=np.clip(r,0,1)[...,None]
    im=Image.fromarray((np.array(c0)*(1-tt)+np.array(c1)*tt).astype(np.uint8)).convert('RGBA'); ov=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(ov); random.seed(len(t)+3)
    if t=='1star':
        for y in range(40,H,90):
            for x in range(40+(45 if (y//90)%2 else 0),W,90): heart(d,x,y,9,(255,255,255,120))
    else:
        for y in range(30,H,60):
            for x in range(30+(30 if (y//60)%2 else 0),W,60): d.ellipse((x-4,y-4,x+4,y+4),fill=(255,255,255,130))
        for i in range(8): x=i*130+20; y=H-50+random.randint(-15,15); d.ellipse((x-90,y-55,x+90,y+65),fill=(255,255,255,170))
    for _ in range(70):
        x,y=random.randint(0,W),random.randint(0,H); s=random.choice([1,2,2,3]); d.ellipse((x-s,y-s,x+s,y+s),fill=(255,255,255,220))
    gl=Image.new('RGBA',(W,H),(0,0,0,0)); ImageDraw.Draw(gl).ellipse((W*.1,H*.22,W*.9,H*.78),fill=(255,255,255,90)); im.alpha_composite(gl.filter(ImageFilter.GaussianBlur(80)))
    im.alpha_composite(ov.filter(ImageFilter.GaussianBlur(.8)))
    for (w,h),suf in(((900,1400),''),((1350,2100),'@2x')): im.resize((w,h),Image.LANCZOS).save(O+f'window-{t}{suf}.webp',quality=88)
