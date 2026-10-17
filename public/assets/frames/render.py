import json
L=json.load(open('layout.json'))
FAM={'basic-1':'pink','basic-2':'pink','basic-3':'pink','4star':'pink','5star':'pink','meme':'pink','character':'pink','legend':'gold'}
WINBG={'basic-1':'1star','basic-2':'2star','basic-3':'3star','4star':'4star','5star':'5star','meme':'meme','character':'character','legend':'legend'}
TXT={'1star':('#5A4030','#7A5236'),'2star':('#26466E','#2F5E9E'),'3star':('#6E3A28','#8A4A30'),'4star':('#1F5A47','#1F6B52'),'5star':('#7A2A4A','#A3305E'),'meme':('#4A3A00','#5A4600'),'character':('#3E2E7A','#5B3FC4'),'legend':('#4A3210','#6E4510')}
CSS='''*{margin:0;box-sizing:border-box}body{background:#1E1A2B;font-family:'Pretendard','Noto Sans CJK KR',sans-serif}
.card{position:relative;width:var(--w);aspect-ratio:900/1400;border-radius:calc(var(--w)*.03);overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.card>*{position:absolute}
.win{overflow:hidden;border-radius:calc(var(--w)*.035)}.win img.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.win img.cat{position:absolute;left:-7%;width:114%;top:55%;transform:translateY(-50%);height:auto}
.frame{inset:0;width:100%;height:100%}
.line,.name{display:flex;align-items:center;justify-content:center;text-align:center}
.line{font-size:calc(var(--w)*.036);font-weight:800;line-height:1.22;letter-spacing:-.02em}
.name{font-family:'Noto Serif CJK KR','Noto Serif CJK JP',serif;font-weight:900;font-size:calc(var(--w)*.056)}
.card.foil:after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.5) 45%,rgba(255,215,250,.32) 50%,transparent 62%);background-size:250% 100%;background-position:30% 0;mix-blend-mode:soft-light;animation:foil 3.2s linear infinite;pointer-events:none}
.card.glit:before{content:'';position:absolute;inset:0;z-index:5;pointer-events:none;background-image:radial-gradient(circle,rgba(255,255,255,.9) 0 1px,transparent 1.6px);background-size:23px 29px;mix-blend-mode:screen;opacity:.35;animation:tw 1.6s steps(2) infinite}
@keyframes foil{from{background-position:120% 0}to{background-position:-120% 0}}@keyframes tw{50%{opacity:.12}}
@media (prefers-reduced-motion:reduce){.card.foil:after,.card.glit:before{animation:none}}'''
def st(b): return f"left:{b['left']:.2f}%;top:{b['top']:.2f}%;width:{b['width']:.2f}%;height:{b['height']:.2f}%"
def card(t,w,line='바라던 일들이 빠짐없이<br>다 이루어지는 날이에요',name='메인쿤'):
    f=L[FAM[t]]; tb=WINBG[t]; a,b=TXT[tb]; cls='card'+(' foil' if tb not in('1star','2star','3star') else '')+(' glit' if tb in('5star','4star','legend','character') else '')
    return (f'<div class="{cls}" style="--w:{w}px"><div class="win" style="{st(f["win"])}"><img class="bg" src="window-{tb}.webp"><img class="cat" src="cat.png"></div>'
            f'<img class="frame" src="frame-{t}.webp"><div class="line" style="{st(f["plate"])};color:{a}">{line}</div><div class="name" style="{st(f["ribbon"])};color:{b}">{name}</div></div>')
LAB={'basic-1':'1★','basic-2':'2★','basic-3':'3★','4star':'4★ 민트','5star':'5★ 핑크','meme':'밈 레몬','character':'캐릭터 라벤더','legend':'레전드 골드'}
def page(body,w,h,extra=''): return f'<html><head><meta charset="utf-8"><style>{CSS}{extra}</style></head><body style="width:{w}px;height:{h}px">{body}</body></html>'
board=''.join(f'<div style="display:flex;flex-direction:column;align-items:center;gap:12px">{card(t,230)}<div style="color:#FFF6E6;font-weight:800;font-size:18px">{LAB[t]}</div></div>' for t in LAB)
open('frames-board-v5.html','w').write(page(f'<div style="display:flex;gap:18px;padding:28px">{board}</div>',9*230+8*18+56,358+56+44))
for t,f in(('basic-1','frame-1star-v5'),('basic-2','frame-2star-v5')):
    open(f+'.html','w').write(page(f'<div style="height:844px;display:flex;align-items:center;justify-content:center;background:radial-gradient(130% 80% at 50% 0%,#3A2F5C,#1E1A2B 55%,#100D1A)">{card(t,350)}</div>',390,844))
# dex minis: downscaled ornate frame (no text)
seq=['basic-1','basic-2','basic-3','4star','5star','meme','character','legend','basic-1','basic-3','4star','legend']
NST={'basic-1':1,'basic-2':2,'basic-3':3,'4star':4,'5star':5}
def mini(t):
    c=card(t,80,'','').replace('<div class="line"','<div hidden class="line"')
    lab='★'*NST[t] if t in NST else {'meme':'MEME','character':'CHAR','legend':'LEGEND'}[t]
    c=c.replace('<div class="name"','<div class="name mst"')
    return c.replace('></div></div>',f'>{lab}</div></div>',1) if False else c.rsplit('</div></div>',1)[0]+lab+'</div></div>'
cells=''.join(f'<div><div class="m">{mini(t)}</div><div class="cn">메인쿤</div></div>' for t in seq)
dcss='.mst{left:8%!important;width:84%!important;top:auto!important;bottom:3%!important;height:16px!important;font-family:Poppins,sans-serif!important;font-size:11px!important;font-weight:900!important;color:#FFD34D!important;background:rgba(42,30,20,.78);border-radius:8px;letter-spacing:.5px;line-height:16px}.grid{display:grid;grid-template-columns:repeat(4,80px);gap:14px 12px;justify-content:center;padding:18px 0}.cn{color:#E8DFF5;font-size:11px;text-align:center;margin-top:5px;font-weight:700}h3{color:#FFF6E6;font-size:17px;padding:22px 20px 0}.m .card{box-shadow:0 4px 10px rgba(0,0,0,.4)}.m .card.glit:before{background-size:9px 11px}'
open('frames-dex-v5.html','w').write(page(f'<h3>도감 · 메인쿤 세트 예시 (v5)</h3><div class="grid">{cells}</div>',390,640,dcss))
