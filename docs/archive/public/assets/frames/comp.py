from PIL import Image,ImageDraw,ImageFilter,ImageOps
import numpy as np
def feather(w,h,f):  # f=dict side->px
    m=np.ones((h,w),np.float32)
    for s,p in f.items():
        if not p: continue
        r=np.linspace(0,1,p)
        if s=='l': m[:,:p]*=r[None,:]
        if s=='r': m[:,-p:]*=r[::-1][None,:]
        if s=='t': m[:p,:]*=r[:,None]
        if s=='b': m[-p:,:]*=r[::-1][:,None]
    return Image.fromarray((m*255).astype(np.uint8))
def put(cv,src,box,pos,f={},flip=False):
    p=src.crop(box)
    if flip: p=ImageOps.mirror(p)
    cv.paste(p,pos,feather(p.width,p.height,f))
def vtile(src,box,H,flip=True):
    p=src.crop(box); out=Image.new('RGB',(p.width,H)); y=0;i=0
    while y<H:
        q=p if (i%2==0 or not flip) else ImageOps.flip(p); out.paste(q,(0,y)); y+=p.height;i+=1
    return out
def htile(src,box,W,flip=True):
    p=src.crop(box); out=Image.new('RGB',(W,p.height)); x=0;i=0
    while x<W:
        q=p if (i%2==0 or not flip) else ImageOps.mirror(p); out.paste(q,(x,0)); x+=p.width;i+=1
    return out
def paper(src,box,W,H):
    p=src.crop(box); out=Image.new('RGB',(W,H))
    for j in range(0,H,p.height):
        for i in range(0,W,p.width):
            q=p
            if (i//p.width)%2: q=ImageOps.mirror(q)
            if (j//p.height)%2: q=ImageOps.flip(q)
            out.paste(q,(i,j))
    return out
