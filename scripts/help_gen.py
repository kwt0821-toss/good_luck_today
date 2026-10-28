import json,html
A='/home/box/agent-data/agents/ebad8054-3dc9-4a3d-b66a-3964321b2a05/assets/'
e=json.load(open(A+'ops-config/economy.json')); ach=json.load(open(A+'ops-config/achievements.json'))
ps=e['pawSources']; ns=e['ncoinSources']; nc=ps['newCardFirstGet']['nyangCoinByGrade']; sc=ps['setComplete']; ad=ps['rewardedAd']
d7=ps['attendance']['weeklyCycle']['day7Bonus']; wd=ps['attendance']['weeklyCycle']['pawDays1to6']; dc=ps['duplicateConvert']
at=sum(x['reward']['nyangCoin'] for x in ach['items']); ap=sum(x['reward']['paw'] for x in ach['items'])
tk=e['shop']['tickets']['rateUpTicket']; wl=e['nyangCoin']['withdraw']; rp=[r['unlock']['paw'] for r in e['rooms'] if r['unlock'].get('paw')]
J={"_version":"help-1.0","_source":"economy.json "+e['_version']+" + achievements.json "+ach['_version']+" (help_gen.py로 생성)","title":"냥코인·젤리 얻는 법",
"tabs":[
{"id":"ncoin","label":"냥코인","icon":"ncoin","lead":"1냥코인 = 1원","sections":[
 {"h":"매일 모으기","rows":[
  {"t":"광고 보고 뽑기","d":"새 카드든 중복이든 1번에","amt":f"+{ns['adDraw']}","cap":f"하루 {ns['adDrawRule']['dailyMax']}번"},
  {"t":"광고 보고 젤리 받기","d":"젤리와 함께 덤으로","amt":f"+{ns['adPaw']}","cap":f"하루 {ns['adPawRule']['dailyMax']}번"},
  {"t":"출석 7일째","d":f"광고 보면 {d7['adBonus']['nyangCoin']}개 + 뽑기권","amt":f"+{d7['base']['nyangCoin']}","cap":"매주 1번"}]},
 {"h":"도감 채우기","rows":[
  {"t":"새 고양이 처음 만나기","d":f"높은 등급일수록 많이, 레전드는 {nc['legend']}개","amt":f"+{nc['b1']}~{nc['legend']}","cap":"카드마다 1번"},
  {"t":"세트 완성","d":"품종·밈·캐릭터·레전드 세트","amt":f"+{sc['breed_1to5star']['nyangCoin']}","cap":"세트마다 1번"},
  {"t":"도감 전부 채우기","d":"107칸 모두","amt":f"+{sc['fullDex']['nyangCoin']}","cap":"1번"},
  {"t":"칭호 얻기","d":f"칭호 {len(ach['items'])}개, 모두 모으면 {at}개","amt":"+1~","cap":"칭호마다 1번"}]}],
 "use":{"h":"이렇게 써요","t":f"{wl['min']}냥코인부터 {wl['unit']}개 단위로 받아요","d":f"하루 최대 {wl['dailyLimit']}원 · 보상함 › 냥코인 받기"}},
{"id":"paw","label":"발바닥 젤리","icon":"paw","lead":"방을 꾸미고 뽑기권을 사요","sections":[
 {"h":"매일 모으기","rows":[
  {"t":"광고 보고 젤리 받기","d":"주말엔 2배","amt":f"+{ad['pawPerAd']}P","cap":f"하루 {ad['maxPerDay']}번"},
  {"t":"출석","d":f"1~6일째 {wd[0]}~{wd[-1]}P, 7일째 광고 보면 {d7['adBonus']['paw']}P","amt":f"+{wd[0]}~{d7['base']['paw']}P","cap":"하루 1번"}]},
 {"h":"카드로 모으기","rows":[
  {"t":"새 고양이 처음 만나기","d":"등급 상관없이","amt":f"+{ps['newCardFirstGet']['paw']}P","cap":"카드마다 1번"},
  {"t":"중복 카드 바꾸기","d":f"남는 카드를 젤리로, 레전드는 {dc['legend']}P","amt":f"+{dc['common_1to2star']}~{dc['legend']}P","cap":"장마다"},
  {"t":"세트 완성","d":f"품종 {sc['breed_1to5star']['paw']}P · 특별 세트 {sc['special']['paw']}P","amt":f"+{sc['breed_1to5star']['paw']}~{sc['special']['paw']}P","cap":"세트마다 1번"},
  {"t":"도감 전부 채우기","d":"107칸 모두","amt":f"+{sc['fullDex']['paw']}P","cap":"1번"},
  {"t":"칭호 얻기","d":f"모두 모으면 {ap}P","amt":"+20P~","cap":"칭호마다 1번"}]}],
 "use":{"h":"이렇게 써요","t":f"확률업 뽑기권 {tk['pricePaw']}P · 방꾸미기 아이템 · 새 방 열기","d":f"뽑기권은 하루 {tk['dailyCap']}장, 최대 {e['tickets']['rateUpTicket']['maxHold']}장 보관 · 새 방 {rp[0]:,}P~"}}],
"entry":["보상함 지갑 카드 오른쪽 위 ? 버튼","메뉴 › 냥코인·젤리 얻는 법"],"footnote":"모든 보상은 서버에서 확인 후 지급돼요"}
json.dump(J,open(A+'help/help.json','w'),ensure_ascii=False,indent=2)
CSS="""*{box-sizing:border-box;margin:0}body{width:390px;height:844px;overflow:hidden;font-family:'Pretendard','Noto Sans CJK KR',sans-serif;background:radial-gradient(120% 70% at 70% 0%,#3A2F5C 0%,#1E1A2B 55%,#141120 100%);position:relative;color:#2A2238}
.st{position:absolute;inset:0}.st i{position:absolute;width:2px;height:2px;border-radius:50%;background:#FFF6E6;opacity:.7}
.dim{position:absolute;inset:0;background:rgba(10,8,20,.45)}
.top{position:absolute;top:54px;left:20px;color:#FFF6E6;font-size:22px;font-weight:900;letter-spacing:-.5px;opacity:.35}
.sh{position:absolute;left:0;right:0;bottom:0;top:96px;background:#FFF6E6;border-radius:28px 28px 0 0;padding:10px 18px 0;display:flex;flex-direction:column}
.grab{width:40px;height:5px;border-radius:3px;background:#D9CCB6;margin:0 auto 12px}
.hd{display:flex;align-items:center;justify-content:space-between}.hd h1{font-size:19px;font-weight:900;letter-spacing:-.4px}
.x{width:32px;height:32px;border-radius:50%;background:#F3E9D7;display:flex;align-items:center;justify-content:center;font-size:16px;color:#6E6478}
.tabs{display:flex;background:#F3E9D7;border-radius:16px;padding:4px;margin:14px 0 12px}.tabs div{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;height:38px;border-radius:12px;font-size:14px;font-weight:800;color:#8B8094}
.tabs .on{background:#1E1A2B;color:#FFF6E6}.tabs img{width:20px;height:20px}
.lead{display:flex;align-items:center;gap:12px;background:#1E1A2B;border-radius:20px;padding:14px 16px;color:#FFF6E6;position:relative;overflow:hidden}
.lead img{width:44px;height:44px}.lead b{font-size:16px;font-weight:900;display:block}.lead span{font-size:12px;color:#BFB4D0}
.lead:after{content:'';position:absolute;right:-20px;top:-30px;width:110px;height:110px;border-radius:50%;background:radial-gradient(circle,#FFE7A8 0%,rgba(255,231,168,0) 65%);opacity:.12}
.body{flex:1;overflow:hidden;padding-top:6px}
.h{font-size:12px;font-weight:800;color:#9A8FA6;margin:14px 2px 6px;letter-spacing:.2px}
.card{background:#fff;border-radius:18px;box-shadow:0 1px 0 #EADFCB}
.r{display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px dashed #EFE4D2}.r:first-child{border-top:0}
.r .tx{flex:1;min-width:0}.r .t{font-size:14px;font-weight:800;letter-spacing:-.3px}.r .d{font-size:11.5px;color:#7A6F86;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.r .a{text-align:right;flex:none}.r .amt{display:inline-flex;align-items:center;gap:4px;font-size:14px;font-weight:900;color:#1F7158;background:#DDF6EC;border-radius:10px;padding:3px 8px}.r .amt img{width:16px;height:16px}
.paw .r .amt{color:#9A4F17;background:#FFE9D2}
.r .cap{font-size:10.5px;color:#A89DB2;margin-top:3px}
.use{margin:10px 0 0;border:1.5px solid #1E1A2B;border-radius:18px;padding:12px 14px;display:flex;gap:10px;align-items:center}
.use .k{flex:none;font-size:11px;font-weight:900;color:#FFF6E6;background:#1E1A2B;border-radius:8px;padding:4px 7px}
.use .t{font-size:13px;font-weight:800;letter-spacing:-.3px}.use .d{font-size:11.5px;color:#7A6F86;margin-top:2px}
.foot{text-align:center;font-size:11px;color:#A89DB2;padding:6px 0 22px}.body{overflow-y:auto}"""
import random
def page(ti):
    T=J['tabs'][ti]; ic='ncoin.png' if T['icon']=='ncoin' else 'icon-paw-coin.svg'
    random.seed(3); stars=''.join(f'<i style="left:{random.randint(0,390)}px;top:{random.randint(0,95)}px"></i>' for _ in range(18))
    tabs=''.join(f'<div class="{"on" if i==ti else ""}"><img src="{"ncoin.png" if t["icon"]=="ncoin" else "icon-paw-coin.svg"}">{t["label"]}</div>' for i,t in enumerate(J['tabs']))
    sec=''.join(f'<div class="h">{s["h"]}</div><div class="card">'+''.join(f'<div class="r"><div class="tx"><div class="t">{r["t"]}</div><div class="d">{html.escape(r["d"])}</div></div><div class="a"><div class="amt"><img src="{ic}">{r["amt"]}</div><div class="cap">{r["cap"]}</div></div></div>' for r in s['rows'])+'</div>' for s in T['sections'])
    u=T['use']
    return f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="st">{stars}</div><div class="top">CAT.</div><div class="dim"></div><div class="sh {T["id"]}"><div class="grab"></div><div class="hd"><h1>{J["title"]}</h1><div class="x">✕</div></div><div class="tabs">{tabs}</div><div class="lead"><img src="{ic}"><div><b>{T["lead"]}</b><span>받은 보상은 보상함에 쌓여요</span></div></div><div class="use"><div class="k">쓰는 곳</div><div><div class="t">{u["t"]}</div><div class="d">{u["d"]}</div></div></div><div class="body">{sec}</div><div class="foot">{J["footnote"]}</div></div></body></html>'
for i,n in enumerate(['help-1-ncoin','help-2-paw']): open(A+f'help/{n}.html','w').write(page(i))
