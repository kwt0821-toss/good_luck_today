V={'reveal-1-new':dict(img='card-front-mainecoon4.png',g='b4',title='메인쿤',grade='4★ · 품종 카드',new=True),
 'reveal-2-dup':dict(img='card-front-bsh2.png',g='b2',title='브리티시 숏헤어',grade='2★ · 품종 카드',new=False,dup='x2 중복 · +10P로 바꿀 수 있어요'),
 'reveal-3-legend':dict(img='card-front-legend-baekho.png',g='legend',title='수호신 백호',grade='LEGEND · 레전드 카드',new=True)}
GL={'b1':('#FFF6E6',.35),'b2':('#FFF6E6',.35),'b3':('#FFF6E6',.45),'b4':('#8FE3C3',.7),'b5':('#FFD36B',.8),'special':('#FFE680',.8),'character':('#C7B0FF',.8),'legend':('#F5D27A',1)}
CSS="""
*{box-sizing:border-box;margin:0}html,body{height:100%}body{width:390px;height:844px;overflow:hidden;font-family:'Pretendard','Noto Sans CJK KR',sans-serif;background:#141120;display:flex;flex-direction:column}
.toss{flex:none;height:103px;background:#fff;display:flex;flex-direction:column;justify-content:flex-end;padding:0 20px 14px;font-weight:800;font-size:18px;color:#191F28}
#card-reveal{flex:1;min-height:0;position:relative;display:flex;flex-direction:column;align-items:center;padding:8px 0 calc(16px + env(safe-area-inset-bottom));
 background:radial-gradient(90% 55% at 50% 42%,rgba(var(--gc),.0) 0%,transparent 60%),radial-gradient(130% 80% at 50% 0%,#3A2F5C 0%,#1E1A2B 55%,#100D1A 100%);overflow:hidden}
.stars i{position:absolute;width:2px;height:2px;border-radius:50%;background:#FFF6E6;opacity:.6}
.top{align-self:stretch;display:flex;justify-content:flex-end;padding:0 16px;height:40px;align-items:center;flex:none;z-index:3}
.x{width:36px;height:36px;border-radius:50%;background:rgba(255,246,230,.12);color:#FFF6E6;display:flex;align-items:center;justify-content:center;font-size:17px}
.stage{flex:1;min-height:0;width:100%;padding:14px 0 4px;display:flex;align-items:center;justify-content:center;position:relative}
.glow{position:absolute;width:115%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,var(--g) 0%,transparent 62%);opacity:var(--go);filter:blur(6px)}
.rays{position:absolute;width:150%;aspect-ratio:1;border-radius:50%;background:repeating-conic-gradient(from 0deg,var(--g) 0 4deg,transparent 4deg 18deg);opacity:calc(var(--go)*.28);-webkit-mask:radial-gradient(circle,#000 10%,transparent 62%)}
.card{position:relative;height:100%;max-width:82%;aspect-ratio:900/1400;border-radius:22px;box-shadow:0 0 0 2px rgba(255,255,255,.08),0 0 46px var(--g),0 24px 50px rgba(0,0,0,.5)}
.card img{width:100%;height:100%;border-radius:22px;display:block}
.badge{position:absolute;top:-12px;right:-10px;background:#FF8A80;color:#fff;font-weight:900;font-size:14px;padding:6px 12px;border-radius:14px;box-shadow:0 6px 14px rgba(0,0,0,.35);transform:rotate(8deg);letter-spacing:.5px}
.info{flex:none;text-align:center;color:#FFF6E6;margin-top:12px}
.info h2{font-size:22px;font-weight:900;letter-spacing:-.5px}.info .g{font-size:13px;color:var(--g);font-weight:800;margin-top:2px}
.dup{display:inline-flex;gap:6px;align-items:center;margin-top:6px;font-size:12.5px;font-weight:800;color:#FFE9D2;background:rgba(255,196,138,.16);border:1px solid rgba(255,196,138,.4);border-radius:12px;padding:4px 10px}.dup img{width:16px}
.hint{font-size:11.5px;color:#9A8FB0;margin-top:6px}
.btns{flex:none;width:100%;padding:12px 18px 0;display:flex;gap:8px}
.btns div{flex:1;height:54px;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;font-size:15px}
.b1{background:#FFF6E6;color:#1E1A2B}.b2{background:transparent;border:1.5px solid rgba(255,246,230,.45);color:#FFF6E6}.b2 small{font-size:10.5px;font-weight:700;color:#BFB4D0;margin-top:1px}
.top{height:50px;justify-content:space-between;gap:10px}
.pill{flex:1;min-width:0;display:flex;align-items:center;gap:8px;height:40px;padding:0 12px 0 6px;border-radius:20px;background:#FFF6E6;border-left:4px solid #8FE3C3;box-shadow:0 8px 20px rgba(0,0,0,.35);font-size:13px;font-weight:800;color:#2A2238;white-space:nowrap}
.pill img{width:28px;height:28px}.pill b{color:#1F7158}
"""
import random
for n,v in V.items():
    c,o=GL[v['g']]; random.seed(len(n))
    st=''.join(f'<i style="left:{random.randint(0,390)}px;top:{random.randint(0,700)}px"></i>' for _ in range(26))
    extra=f'<div class="dup"><img src="icon-paw-coin.svg">{v["dup"]}</div>' if not v['new'] else ''
    badge='<div class="badge">NEW</div>' if v['new'] else ''
    h=f'''<html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="toss">럭키캣</div>
<section id="card-reveal" style="--g:{c};--go:{o}"><div class="stars">{st}</div>
<div class="top"><div class="pill" id="ny-adcoin"><img src="ncoin.png"><span>카드를 뽑아 <b>냥코인x1</b>이 지급되었습니다.</span></div><div class="x">✕</div></div>
<div class="stage"><div class="rays"></div><div class="glow"></div><div class="card" id="reveal-card"><img src="{v['img']}">{badge}</div></div>
<div class="info"><h2>{v['title']}</h2><div class="g">{v['grade']}</div>{extra}<div class="hint">카드를 누르면 뒷면을 볼 수 있어요</div></div>
<div class="btns"><div class="b2" id="btn-draw-again">한 장 더 뽑기<small>광고 · 남은 2회</small></div><div class="b1" id="btn-to-dex">도감에서 보기</div></div>
</section></body></html>'''
    open(n+'.html','w').write(h)
