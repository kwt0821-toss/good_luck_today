from build_v4 import *
SKY=((110,170,235,255),(60,110,180),(200,226,250))
def build5(t):
    POST.clear(); cv=base().convert('RGBA'); cx=CW//2
    simple(cv); globals()['PLATE']=bigplate(cv)
    if t=='basic-1':
        cv=recolor(cv,28,.5,.97)
        heart(cv,cx,34,22,(232,150,130,255)); heart(cv,cx,34,15,(255,200,185,255))
        cv.alpha_composite(STAR,(cx-STAR.width//2,84-STAR.height//2))
        rim(cv,(140,105,70,255),(205,170,130,255),(245,228,205,255),.45)
        for x,y,s in((cx-60,36,9),(cx+60,36,9)): sparkle(cv,[(x,y,s)])
    else:
        cv=recolor(cv,205,.6,1.0)
        g=facet_gem('round',40,*SKY); cv.alpha_composite(g,(cx-20,12))
        for x in(cx-30,cx+30): cv.alpha_composite(STAR,(x-STAR.width//2,84-STAR.height//2))
        rim(cv,(110,120,140,255),(200,210,225,255),(246,250,255,255),.6)
        d=ImageDraw.Draw(cv)
        for y in range(170,CH-170,44):
            for x in(66,CW-66): d.ellipse((x-3,y-3,x+3,y+3),fill=(255,255,255,200))
        sg=facet_gem('round',30,*SKY)
        POST.append(lambda c: [c.alpha_composite(sg,(x-15,y-15)) for x,y in((WIN[0]+2,WIN[1]+2),(WIN[2]-2,WIN[1]+2),(WIN[0]+2,WIN[3]-2),(WIN[2]-2,WIN[3]-2))])
    return cv
if __name__=='__main__':
    for t in['basic-1','basic-2']:
        cv=build5(t).convert('RGBA'); mask=Image.new('L',(CW,CH),0); ImageDraw.Draw(mask).rounded_rectangle(WIN,R,fill=255); mask=mask.filter(ImageFilter.GaussianBlur(2.5))
        a=np.asarray(cv).copy(); a[...,3]=np.minimum(a[...,3],255-np.asarray(mask)); cv=Image.fromarray(a)
        for f in POST: f(cv)
        cv.save('v5-'+t+'-raw.png')
