from build_v3 import *
from orn import *
PINKD=((242,110,160,255),(196,60,112),(255,196,222))
MINT=((70,205,155,255),(28,140,100),(178,244,214))
PEACH=((244,160,130,255),(200,110,85),(255,215,195))
def medallion_restore(cv):
    # re-paste medallion from source over wings (circle)
    p=S.crop((560,0,745,160)).convert('RGBA'); m=Image.new('L',p.size,0); ImageDraw.Draw(m).ellipse((6,4,154,150),fill=255); ImageDraw.Draw(m).ellipse((115,80,182,156),fill=255); p.putalpha(m.filter(ImageFilter.GaussianBlur(2)))
    cv.alpha_composite(p,(560-130,0))
def beads_on_rim(cv,step,r,base,off=0):
    x0,y0,x1,y1=WIN; e=off; pts=[]
    for x in range(x0+50,x1-49,step): pts+=[(x,y0-e),(x,y1+e)]
    for y in range(y0+50,y1-49,step): pts+=[(x0-e,y),(x1+e,y)]
    bead_line(cv,pts,r,base)
HEARTS=[(68,420,16),(952,470,14),(70,1150,14),(950,1100,16),(64,780,12),(956,820,12)]
def build4(t):
    POST.clear(); cv=base().convert('RGBA')
    cx=CW//2
    if t=='5star':
        ornate(cv); globals()['PLATE']=bigplate(cv)
        # wings behind medallion
        wl=wing(92); wr=wing(92,True)
        cv.alpha_composite(wl,(cx-58-wl.width,-4)); cv.alpha_composite(wr,(cx+58,-4)); medallion_restore(cv)
        for x in(cx-178,cx-236,cx+178,cx+236): cv.alpha_composite(STAR,(x-STAR.width//2,70-STAR.height//2))
        cv.alpha_composite(STAR,(cx-STAR.width//2,4))
        rim(cv,(140,85,35,255),(236,184,92,255),(255,238,178,255),1.25,glow=(255,200,150,230))
        beads_on_rim(cv,34,6,(240,196,100),off=20)
        dg=facet_gem('diamond',62,*PINKD)
        for y in(CH//2-150,CH//2+150): cv.alpha_composite(dg,(8,y-31)); cv.alpha_composite(dg,(CW-70,y-31))
        for x,y,s in HEARTS: heart(cv,x,y,s,(255,140,180,255))
        sparkle(cv,SP+[(250,300,10),(770,300,10),(240,1390,10),(780,1390,10)])
        hg=facet_gem('heart',96,*PINKD); dr=facet_gem('drop',40,*PINKD)
        POST.append(lambda c: lace(c,WIN[0]+30,WIN[2]-30,WIN[1]+1,13,True,col=(255,250,252,235),edge=(230,170,190,255)))
        POST.append(lambda c: lace(c,WIN[0]+30,WIN[2]-30,WIN[3]-1,13,False,col=(255,250,252,235),edge=(230,170,190,255)))
        POST.append(lambda c: pearl_string(c,WIN[1]+16,WIN[0]+60,cx-70,58,11,r=10,base=(255,250,244)))
        POST.append(lambda c: pearl_string(c,WIN[1]+16,cx+70,WIN[2]-60,58,11,r=10,base=(255,250,244)))
        POST.append(lambda c: pearl_string(c,WIN[1]+16,WIN[0]+40,WIN[2]-40,110,30,r=7,base=(255,236,242)))
        POST.append(lambda c: [tassel(c,x,WIN[1]+8,70,dr) for x in(WIN[0]+46,WIN[2]-46)])
        POST.append(lambda c: [c.alpha_composite(hg,(x-48,y-48)) for x,y in((WIN[0]-2,WIN[1]-2),(WIN[2]+2,WIN[1]-2),(WIN[0]-2,WIN[3]+2),(WIN[2]+2,WIN[3]+2))])
    elif t=='4star':
        simple(cv); cv=recolor(cv,158,.8,1.0); globals()['PLATE']=bigplate(cv); cv=recolor(cv,158,.8,1.0)
        cr=crown(190,*MINT); cv.alpha_composite(cr,(cx-cr.width//2,2))
        for x in(cx-120,cx-178,cx+120,cx+178): cv.alpha_composite(STAR,(x-STAR.width//2,80-STAR.height//2))
        rim(cv,(110,75,30,255),(228,178,86,255),(255,238,184,255),1.1,glow=(150,255,215,220))
        beads_on_rim(cv,40,5,(236,194,100),off=18)
        og=facet_gem('octagon',70,*MINT)
        for y in(CH//2-180,CH//2,CH//2+180): cv.alpha_composite(og,(32,y-35)); cv.alpha_composite(og,(CW-102,y-35))
        for x,y,s in HEARTS[:4]: heart(cv,x,y,s,(120,215,180,255))
        sparkle(cv,SP)
        dr=facet_gem('drop',36,*MINT); cg=facet_gem('octagon',84,*MINT)
        POST.append(lambda c: lace(c,WIN[0]+30,WIN[2]-30,WIN[1]+1,12,True,col=(250,255,252,235),edge=(140,200,175,255)))
        POST.append(lambda c: pearl_string(c,WIN[1]+14,WIN[0]+60,WIN[2]-60,70,24,r=9,base=(252,255,250)))
        POST.append(lambda c: [tassel(c,x,WIN[1]+6,56,dr) for x in(WIN[0]+44,WIN[2]-44)])
        POST.append(lambda c: [c.alpha_composite(cg,(x-42,y-42)) for x,y in((WIN[0]-2,WIN[1]-2),(WIN[2]+2,WIN[1]-2),(WIN[0]-2,WIN[3]+2),(WIN[2]+2,WIN[3]+2))])
    elif t=='basic-3':
        simple(cv); globals()['PLATE']=bigplate(cv); cv=recolor(cv,14,.55,1.0)
        g=facet_gem('round',46,*PEACH); cv.alpha_composite(g,(cx-23,10))
        sparkle(cv,[(cx-50,33,12),(cx+50,33,12)])
        for x in(cx-58,cx,cx+58): cv.alpha_composite(STAR,(x-STAR.width//2,84-STAR.height//2))
        rim(cv,(150,95,60,255),(226,170,130,255),(252,226,206,255),.8,glow=(255,200,180,150))
        sparkle(cv,SP[:4])
        sg=facet_gem('round',40,*PEACH)
        POST.append(lambda c: pearl_string(c,WIN[1]+12,WIN[0]+60,WIN[2]-60,50,22,r=7,base=(255,246,240)))
        POST.append(lambda c: [c.alpha_composite(sg,(x-20,y-20)) for x,y in((WIN[0]+2,WIN[1]+2),(WIN[2]-2,WIN[1]+2),(WIN[0]+2,WIN[3]-2),(WIN[2]-2,WIN[3]-2))])
    return cv
if __name__=='__main__':
    for t in['basic-3','4star','5star']:
        cv=build4(t).convert('RGBA'); mask=Image.new('L',(CW,CH),0); ImageDraw.Draw(mask).rounded_rectangle(WIN,R,fill=255); mask=mask.filter(ImageFilter.GaussianBlur(2.5))
        a=np.asarray(cv).copy(); a[...,3]=np.minimum(a[...,3],255-np.asarray(mask)); cv=Image.fromarray(a)
        for f in POST: f(cv)
        cv.save('v4-'+t+'-raw.png')
