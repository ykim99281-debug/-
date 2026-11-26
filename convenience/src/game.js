import { createWorld } from './scene.js';
let V3=null,padMsg=0;

const fmt=n=>{n=Math.floor(n);const u=['','만','억','조','경','해'];if(n<10000)return n.toLocaleString();let i=0,v=n;while(v>=10000&&i<u.length-1){v/=10000;i++}return (v>=100?v.toFixed(0):v.toFixed(1))+u[i]};

// 직원: 초당 수입 (names: 고용할 때마다 순서대로 이름이 붙어요)
const STAFF=[
 {id:'part',ic:'🧑‍🎓',nm:'알바생',ds:'친절한 야간 알바',base:15,ps:1,names:['민수','지아','도윤','서연','하준','유나']},
 {id:'cashier',ic:'💁',nm:'전담 캐셔',ds:'계산이 빠르다',base:120,ps:8,names:['은지','태민','소라','준호','다은']},
 {id:'night',ic:'🦉',nm:'야간 매니저',ds:'밤새 매장을 지킨다',base:900,ps:50,names:['강 매니저','한 매니저','윤 매니저']},
 {id:'manager',ic:'🧑‍💼',nm:'점장',ds:'매장을 책임진다',base:7000,ps:350,names:['김 점장','이 점장','박 점장','최 점장']},
 {id:'barista',ic:'☕',nm:'바리스타',ds:'커피 코너 운영',base:55000,ps:2400,names:['로이','에밀리','하루','카를로']},
 {id:'logi',ic:'🚚',nm:'물류 담당',ds:'재고가 마르지 않는다',base:450000,ps:17000,names:['쿠팡맨','새벽배송','트럭왕']},
 {id:'ai',ic:'🤖',nm:'무인 계산 로봇',ds:'24시간 풀가동',base:4000000,ps:120000,names:['R-01','R-02','R-03','R-04']},
 {id:'ceo',ic:'🧠',nm:'AI 점장',ds:'전 지점을 자동 최적화',base:40000000,ps:900000,names:['알파','베타','감마','델타']},
];
// 상품: 클릭 수입 증가
const GOODS=[
 {id:'snack',ic:'🍫',nm:'과자·음료',ds:'클릭당 +1',base:30,add:1},
 {id:'lunch',ic:'🍙',nm:'삼각김밥·도시락',ds:'클릭당 +5',base:300,add:5},
 {id:'ice',ic:'🍦',nm:'아이스크림',ds:'클릭당 +30',base:3000,add:30},
 {id:'cafe',ic:'🥤',nm:'커피·즉석음료',ds:'클릭당 +150',base:25000,add:150},
 {id:'beer',ic:'🍺',nm:'주류 코너',ds:'클릭당 +900',base:200000,add:900},
 {id:'gift',ic:'🎁',nm:'택배·상품권',ds:'클릭당 +6,000',base:1600000,add:6000},
 {id:'lotto',ic:'🎫',nm:'복권',ds:'클릭당 +40,000',base:13000000,add:40000},
 {id:'phone',ic:'📱',nm:'휴대폰 충전·통신',ds:'클릭당 +300,000',base:110000000,add:300000},
];
// 매장 업그레이드 (1회성)
const UPS=[
 {id:'sign',ic:'💡',nm:'LED 간판',ds:'모든 수입 +10%',cost:500,m:.1},
 {id:'fridge',ic:'🧊',nm:'대형 냉장고',ds:'모든 수입 +20%',cost:5000,m:.2},
 {id:'micro',ic:'♨️',nm:'전자레인지 코너',ds:'모든 수입 +20%',cost:25000,m:.2},
 {id:'atm',ic:'🏧',nm:'ATM 설치',ds:'모든 수입 +30%',cost:100000,m:.3},
 {id:'h24',ic:'🌙',nm:'24시간 영업',ds:'모든 수입 +50%',cost:1000000,m:.5},
 {id:'eat',ic:'🪑',nm:'취식 공간',ds:'모든 수입 +50%',cost:8000000,m:.5},
 {id:'app',ic:'📲',nm:'멤버십 앱',ds:'모든 수입 +100%',cost:60000000,m:1},
 {id:'brand',ic:'🌟',nm:'자체 브랜드(PB)',ds:'모든 수입 +150%',cost:500000000,m:1.5},
];
const RANKS=[
 [0,'🥱 초보 알바','🏚️'],[500,'🙂 야간 점장','🏪'],[10000,'😎 동네 사장님','🏪🏪'],
 [300000,'🤑 3호점 사장','🏬'],[10000000,'👔 프랜차이즈 본부장','🏢'],[500000000,'👑 편의점 재벌','🏙️🏢🏙️'],
 [30000000000,'🌍 글로벌 회장','🌍🏢🌍']
];
const EVENTS=[
 {t:'🧓 단골 할머니가 "수고 많네~" 하며 팁을 주려 해요!',y:'받는다',gain:s=>60*s.ps+200},
 {t:'🥫 유통기한 임박 상품! 1+1 할인 행사를 할까요?',y:'행사 진행',gain:s=>40*s.ps+300},
 {t:'😡 진상 손님이 환불을 요구해요. 환불해줄까요?',y:'환불해준다',gain:s=>-(20*s.ps+100),n:'거절한다',bad:true},
 {t:'📦 택배 대량 입고! 정리하면 수당이 나와요.',y:'정리한다',gain:s=>80*s.ps+500},
 {t:'🎉 근처 축제로 손님이 몰려와요! 서둘러 응대!',y:'파이팅!',gain:s=>120*s.ps+1000},
];

const sumLv=o=>Object.values(o).reduce((a,b)=>a+b,0);
const ACH=[
 {id:'t1',nm:'첫 손님',ds:'손님 1명 응대',ok:()=>S.taps>=1},
 {id:'t100',nm:'손이 빨라요',ds:'손님 100명 응대',ok:()=>S.taps>=100},
 {id:'t1000',nm:'계산대의 달인',ds:'손님 1,000명 응대',ok:()=>S.taps>=1000},
 {id:'h1',nm:'첫 직원',ds:'직원 1명 고용',ok:()=>sumLv(S.staff)>=1},
 {id:'h25',nm:'북적이는 매장',ds:'직원 25명 고용',ok:()=>sumLv(S.staff)>=25},
 {id:'g20',nm:'꽉 찬 진열대',ds:'상품 레벨 합 20',ok:()=>sumLv(S.goods)>=20},
 {id:'u4',nm:'인테리어 중독',ds:'매장 업그레이드 4개',ok:()=>Object.keys(S.ups).length>=4},
 {id:'uall',nm:'완벽한 매장',ds:'매장 업그레이드 전부',ok:()=>Object.keys(S.ups).length>=UPS.length},
 {id:'m1',nm:'만 원의 행복',ds:'누적 매출 1만',ok:()=>S.total>=1e4},
 {id:'m6',nm:'백만장자',ds:'누적 매출 100만',ok:()=>S.total>=1e6},
 {id:'m9',nm:'억대 사장님',ds:'누적 매출 1억',ok:()=>S.total>=1e8},
 {id:'m12',nm:'조 단위 재벌',ds:'누적 매출 1조',ok:()=>S.total>=1e12},
 {id:'e5',nm:'사건 사고',ds:'이벤트 5번 처리',ok:()=>S.evs>=5},
 {id:'f1',nm:'프랜차이즈 사장',ds:'프랜차이즈 1호점 오픈',ok:()=>S.fran>=1},
 {id:'s7',nm:'개근상',ds:'7일 연속 출석',ok:()=>S.streak>=7},
];
function checkAch(){let n=0;ACH.forEach(a=>{if(!S.ach[a.id]&&a.ok()){S.ach[a.id]=1;n++;toast('🏆 업적 달성! '+a.nm+' (수입 +2%)');beep('ach')}});if(n)render(1)}

// 소리 (WebAudio, 파일 없이 합성)
let AC=null;
function beep(k){
  if(S.mute)return;
  try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();
    const seq={tap:[[880,.05]],buy:[[660,.07],[990,.09]],ach:[[660,.08],[880,.08],[1320,.14]],rank:[[523,.1],[659,.1],[784,.1],[1047,.2]],bad:[[220,.15]],coin:[[1200,.05],[1600,.08]]}[k]||[];
    let t=AC.currentTime;seq.forEach(([f,d])=>{const o=AC.createOscillator(),g=AC.createGain();o.type=k==='bad'?'sawtooth':'square';o.frequency.value=f;g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+d);t+=d});
  }catch(e){}
}

const KEY='cvs_boss_v1';
let S=load();
function def(){return{money:0,total:0,staff:{},goods:{},ups:{},fran:0,t:Date.now(),taps:0,ach:{},mute:false,daily:'',streak:0,evs:0,look:{hat:'crown',shirt:'#c4281c',pants:'#1f1f23',skin:'#f5cd30',cap:'#c4281c'},own:{},t0:Date.now()}}
function load(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d)return Object.assign(def(),d)}catch(e){}return def()}
function save(){S.t=Date.now();try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}

const lv=(o,id)=>o[id]||0;
const GROW=1.2;
const cost=(it,n)=>Math.floor(it.base*Math.pow(GROW,n));
const achN=()=>Object.keys(S.ach).length;
const mult=()=>(1+UPS.reduce((a,u)=>a+(S.ups[u.id]?u.m:0),0))*(1+S.fran*0.5)*(1+achN()*0.02);
const perSec=()=>STAFF.reduce((a,s)=>a+lv(S.staff,s.id)*s.ps,0)*mult();
const perTap=()=>(1+GOODS.reduce((a,g)=>a+lv(S.goods,g.id)*g.add,0))*mult();
const rankIdx=()=>{let r=0;RANKS.forEach((x,i)=>{if(S.total>=x[0])r=i});return r};

const HATS=[['crown','👑','황금 왕관',0],['none','🙂','모자 없음',0],['cap','🧢','야구 모자',300],['tophat','🎩','실크햇',5000],['hard','⛑️','안전모',2000],['hood','🧥','후드',1500]];
const SHIRTS=[['#c4281c','🟥','빨강',0],['#0d69ac','🟦','파랑',200],['#4b974b','🟩','초록',200],['#f5cd30','🟨','노랑',200],['#7b2fbe','🟪','보라',800],['#1f1f23','⬛','블랙',800],['#e0508a','🌸','핑크',800],['#ffd23f','✨','골드',30000]];
const SKINS=[['#f5cd30','🟡','클래식 노랑',0],['#fdd8b5','🧑','살구',0],['#c4915e','🧑🏽','구릿빛',0],['#9ae07a','🟢','라임',1000],['#8fd3ff','🔵','하늘',1000],['#c8a2ff','🟣','라벤더',1000]];
function lookRows(L){
  const grp=(title,list,key)=>{
    const h=document.createElement('div');h.className='sub';h.style.cssText='margin:10px 2px 6px;font-weight:800';h.textContent=title;L.appendChild(h);
    list.forEach(([val,ic,nm,c])=>{const id=key+':'+val,have=c===0||S.own[id],on=S.look[key]===val;
      L.appendChild(row(ic,nm,on?'착용 중':have?'보유':'꾸미기 아이템',on?'착용 중':have?'착용':`구매<br>₩${fmt(c)}`,on||(!have&&S.money<c),()=>{if(!have){S.money-=c;S.own[id]=1;beep('buy')}S.look[key]=val;if(key==='hat'&&val==='cap')S.look.cap=S.look.shirt;if(V3)V3.setLook(S.look);save();render(1)}))});
  };
  grp('🎩 모자',HATS,'hat');grp('👕 상의',SHIRTS,'shirt');grp('🧑 피부색',SKINS,'skin');
}
let tab='staff';
function buy(id){
  const [k,key]=id.split(':');let it,n,c;
  if(k==='s'){it=STAFF.find(x=>x.id===key);n=lv(S.staff,key);c=cost(it,n);if(S.money<c)return false;S.money-=c;S.staff[key]=n+1}
  else if(k==='g'){it=GOODS.find(x=>x.id===key);n=lv(S.goods,key);c=cost(it,n);if(S.money<c)return false;S.money-=c;S.goods[key]=n+1}
  else{it=UPS.find(x=>x.id===key);if(S.ups[key]||S.money<it.cost)return false;S.money-=it.cost;S.ups[key]=1}
  beep('buy');checkAch();render(1);return true;
}
function padList(){
  const L=[];
  STAFF.forEach((s,i)=>{const n=lv(S.staff,s.id),c=cost(s,n);L.push({id:'s:'+s.id,kind:'staff',icon:s.ic,name:s.nm,sub:'Lv.'+n+' · 초당 +'+fmt(s.ps*mult()),cost:'₩'+fmt(c),state:S.money>=c?'ok':'no'})});
  GOODS.forEach((g,i)=>{const n=lv(S.goods,g.id),c=cost(g,n);L.push({id:'g:'+g.id,kind:'goods',icon:g.ic,name:g.nm.length>7?g.nm.slice(0,7):g.nm,sub:'Lv.'+n+' · '+g.ds,cost:'₩'+fmt(c),state:S.money>=c?'ok':'no'})});
  UPS.forEach(u=>{if(S.ups[u.id])return;L.push({id:'u:'+u.id,kind:'up',icon:u.ic,name:u.nm,sub:u.ds.replace('모든 수입 ','수입 '),cost:'₩'+fmt(u.cost),state:S.money>=u.cost?'ok':'no'})});
  return L;
}
const NAMES=()=>{const o={};STAFF.forEach(s=>{const n=lv(S.staff,s.id);o[s.id]=[0,1].map(i=>s.names[(Math.max(0,n-1-(1-i)*0)+i*1)%s.names.length]);o[s.id]=[s.names[0],s.names[1%s.names.length]]});return o};
const $=id=>document.getElementById(id);
function toast(m){const t=$('toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',2200)}
function log(m){const l=$('log');l.textContent=m;l.style.opacity=1;clearTimeout(log.h);log.h=setTimeout(()=>l.style.opacity=0,1200)}

function render(force){
  const ri=rankIdx(),nx=RANKS[ri+1];
  $('rank').textContent=RANKS[ri][1]+(S.fran?` · 🏆${S.fran}호`:'');
  if(V3){V3.sync(S,ri,NAMES());V3.setRate(perSec())}
  $('money').textContent='₩ '+fmt(S.money);
  $('rate').textContent=`초당 ₩${fmt(perSec())} · 클릭당 ₩${fmt(perTap())} · 수입배율 ×${mult().toFixed(2)}`;
  if(nx){const p=(S.total-RANKS[ri][0])/(nx[0]-RANKS[ri][0]);$('prog').style.width=Math.min(100,p*100)+'%';$('progt').textContent=`다음 등급 ${nx[1]} 까지 ₩${fmt(nx[0]-S.total)}`}
  else{$('prog').style.width='100%';$('progt').textContent='최고 등급 달성!'}
  const sig=tab+[...STAFF,...GOODS].map(i=>S.money>=cost(i,lv(S.staff,i.id)+lv(S.goods,i.id))?1:0).join('')+UPS.map(u=>S.ups[u.id]?2:S.money>=u.cost?1:0).join('')+S.total*0+(tab==='info'?Math.floor(S.total):'');
  if(sig!==render.sig||force){render.sig=sig;renderList();if(V3)V3.setPads(padList())}
}
function row(ic,nm,ds,btn,dis,fn){
  const d=document.createElement('div');d.className='item';
  d.innerHTML=`<div class="ic">${ic}</div><div class="in"><div class="nm">${nm}</div><div class="ds">${ds}</div></div>`;
  if(btn){const b=document.createElement('button');b.innerHTML=btn;b.disabled=dis;b.onclick=fn;d.appendChild(b)}
  return d;
}
function renderList(){
  const L=$('list');L.innerHTML='';
  if(tab==='staff')STAFF.forEach(s=>{const n=lv(S.staff,s.id),c=cost(s,n);
    L.appendChild(row(s.ic,`${s.nm} Lv.${n}`,`${s.ds} · 초당 +${fmt(s.ps*mult())}${n?'<br>👋 최근 고용: '+s.names[(n-1)%s.names.length]+(n>s.names.length?' '+Math.ceil(n/s.names.length)+'호':''):''}`,`고용<br>₩${fmt(c)}`,S.money<c,()=>buy('s:'+s.id)))});
  else if(tab==='goods')GOODS.forEach(g=>{const n=lv(S.goods,g.id),c=cost(g,n);
    L.appendChild(row(g.ic,`${g.nm} Lv.${n}`,g.ds,`입고<br>₩${fmt(c)}`,S.money<c,()=>buy('g:'+g.id)))});
  else if(tab==='store')UPS.forEach(u=>{const have=S.ups[u.id];
    L.appendChild(row(u.ic,u.nm,u.ds,have?'완료':`구매<br>₩${fmt(u.cost)}`,have||S.money<u.cost,()=>buy('u:'+u.id)))});
  else if(tab==='look')lookRows(L);
  else if(tab==='ach'){
    ACH.forEach(a=>{const d=row(S.ach[a.id]?'🏆':'🔒',a.nm,a.ds+' · 수입 +2%',null);d.classList.add('ach');if(S.ach[a.id])d.classList.add('done');L.appendChild(d)});
  }
  else{
    const need=1e12*Math.pow(3,S.fran);
    const d=document.createElement('div');d.className='stats';
    d.innerHTML=`누적 매출: ₩${fmt(S.total)}<br>업적: ${achN()}/${ACH.length} · 연속 출석 ${S.streak}일<br>총 클릭: ${S.taps.toLocaleString()}회<br>프랜차이즈 지점: ${S.fran}개 (수입 +${S.fran*50}%)<br>
    <span class="sub">누적 매출 ₩${fmt(need)} 달성 시 프랜차이즈를 열 수 있어요. 모든 진행은 초기화되지만 영구 수입 +50%!</span>`;
    const b=document.createElement('button');b.className='btn2 prest';b.textContent=`🏆 프랜차이즈 ${S.fran+1}호점 오픈`;b.disabled=S.total<need;b.style.opacity=b.disabled?.4:1;
    b.onclick=()=>{if(S.total<need||!confirm('진행 상황이 초기화되고 영구 보너스를 얻습니다. 진행할까요?'))return;const o=S;S=def();S.fran=o.fran+1;S.taps=o.taps;S.ach=o.ach;S.mute=o.mute;S.daily=o.daily;S.streak=o.streak;S.evs=o.evs;S.look=o.look;S.own=o.own;S.t0=o.t0;lastRank=0;checkAch();save();render(1);toast('🎉 프랜차이즈 오픈!')};
    const r=document.createElement('button');r.className='btn2 reset';r.textContent='데이터 완전 초기화';
    r.onclick=()=>{if(confirm('정말 모든 데이터를 삭제할까요?')){S=def();lastRank=0;save();render(1)}};
    d.appendChild(b);d.appendChild(r);L.appendChild(d);
  }
}

const MSG=['어서오세요!','봉투 필요하세요?','포인트 적립하시나요?','데워드릴까요?','영수증 드릴까요?','담배 뭐 드릴까요?','택배 찾으러 왔어요~'];
function doTap(x,y){
  const g=perTap();S.money+=g;S.total+=g;S.taps++;
  const v=document.body,r={left:0,top:0,width:innerWidth,height:innerHeight};
  const f=document.createElement('div');f.className='float';f.textContent='+'+fmt(g);
  f.style.left=((x==null?r.width/2+(Math.random()-.5)*60:x)-14)+'px';f.style.top=((y==null?r.height*.42:y)-20)+'px';
  v.appendChild(f);setTimeout(()=>f.remove(),1000);
  log('"'+MSG[Math.floor(Math.random()*MSG.length)]+'"');
  beep('tap');checkAch();render();
}
$('tap').addEventListener('click',e=>doTap(null,null));
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on');tab=b.dataset.t;render(1)});

const customer=()=>{};
function bump(){}
$('snd').onclick=()=>{S.mute=!S.mute;$('snd').textContent=S.mute?'🔇':'🔊';
let night=false;$('cam').onclick=()=>{night=!night;if(V3)V3.setNight(night);toast(night?'🌙 밤':'☀️ 낮')};save();beep('tap')};
$('snd').textContent=S.mute?'🔇':'🔊';
let night=false;$('cam').onclick=()=>{night=!night;if(V3)V3.setNight(night);toast(night?'🌙 밤':'☀️ 낮')};

// 일일 출석 보너스
function daily(){
  const today=new Date().toLocaleDateString('sv');
  if(S.daily===today)return;
  const y=new Date(Date.now()-864e5).toLocaleDateString('sv');
  const streak=S.daily===y?S.streak+1:1;
  const reward=Math.floor((600*Math.max(perSec(),perTap()*3)+500)*(1+Math.min(streak,7)*.25));
  const el=$('event');
  el.innerHTML=`<b>📅 출석 ${streak}일차! 오늘의 보너스 ₩${fmt(reward)}${streak>=7?' (7일 이상 연속 보너스!)':''}</b><div class="row"><button id="dy">받기</button></div>`;
  el.style.display='block';
  $('dy').onclick=()=>{S.money+=reward;S.total+=reward;S.daily=today;S.streak=streak;el.style.display='none';beep('coin');toast('+₩'+fmt(reward));checkAch();save();render(1)};
}

// 오프라인 수입
(function(){const sec=Math.min((Date.now()-S.t)/1000,8*3600);if(sec>30&&perSec()>0){const g=perSec()*sec*.5;S.money+=g;S.total+=g;setTimeout(()=>toast(`💤 자리를 비운 동안 ₩${fmt(g)} 벌었어요!`),300)}})();

// 틱
let last=Date.now(),lastRank=rankIdx();
setInterval(()=>{
  const now=Date.now(),dt=(now-last)/1000;last=now;
  const g=perSec()*dt;S.money+=g;S.total+=g;
  const ri=rankIdx();if(ri>lastRank&&lastRank>=0&&ri>0){toast('🎊 승진! '+RANKS[ri][1]);beep('rank');if(V3)V3.celebrate()}lastRank=ri;
  if(Math.random()<Math.min(.9,perSec()/400))customer();checkAch();
  render();
},500);
setInterval(save,5000);
addEventListener('beforeunload',save);

// 랜덤 이벤트
function spawn(){
  if($('event').style.display==='block'||perSec()<=0&&S.total<100)return;
  const e=EVENTS[Math.floor(Math.random()*EVENTS.length)],s={ps:perSec()||perTap()};
  const el=$('event');
  el.innerHTML=`<b>${e.t}</b><div class="row"><button id="ey">${e.y}</button><button class="no" id="en">${e.n||'무시'}</button></div>`;
  el.style.display='block';
  const close=()=>{el.style.display='none'};
  $('ey').onclick=()=>{const g=e.gain(s);S.money=Math.max(0,S.money+g);if(g>0)S.total+=g;S.evs++;beep(g<0?'bad':'coin');checkAch();toast((g>=0?'+':'')+'₩'+fmt(g));close();render()};
  $('en').onclick=()=>{S.evs++;close()};
  clearTimeout(spawn.h);spawn.h=setTimeout(close,12000);
}
setInterval(()=>{if(Math.random()<.5)spawn()},20000);


render();
lastRank=rankIdx();
try{
  V3=createWorld($('gl'),$('view'),{onTap:()=>doTap(null,null),onPad:id=>{const ok=buy(id);if(!ok&&Date.now()-(padMsg||0)>1500){padMsg=Date.now();toast('💸 돈이 부족해요!')}return ok},onPay:()=>{beep('coin')}});
  window.__V3=V3;V3.setLook(S.look);setTimeout(()=>{const l=$('load');l.style.opacity=0;setTimeout(()=>l.remove(),600)},600);
}catch(e){console.warn('3D 불가',e);$('view').style.display='none';$('nogl').style.display='block'}
render(1);checkAch();setTimeout(daily,800);
const BOTS=[['편의점왕 👑',9e5,2.4],['야간점장 🌙',2e5,2.0],['알바천국 🧑‍🎓',6e4,1.6],['24시사장 🏪',2e4,1.3],['초코맨 🍫',4e3,1.0]];
function lb(){const h=(Date.now()-(S.t0||Date.now()))/36e5;const rows=BOTS.map(([n,b,r])=>[n,b*Math.exp(r*h*3)]);rows.push(['나 (사장님)',S.total,1]);rows.sort((a,b)=>b[1]-a[1]);
  $('lb').innerHTML='<b>🏆 순위</b>'+rows.slice(0,6).map((r,i)=>`<div class="${r[2]===1?'me':''}">${i+1}. ${r[0]} <span>₩${fmt(r[1])}</span></div>`).join('')}
lb();setInterval(lb,2000);
$('menu').onclick=()=>{$('sheet').classList.toggle('open');render(1)};$('close').onclick=()=>$('sheet').classList.remove('open');
$('jump').onclick=()=>V3&&V3.jump();
(function(){const j=$('joy'),k=$('knob');let id=null;const R=44;
 const set=(e)=>{const r=j.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy;const d=Math.hypot(dx,dy);if(d>R){dx=dx/d*R;dy=dy/d*R}k.style.transform=`translate(${dx}px,${dy}px)`;if(V3)V3.setJoy(dx/R,-dy/R)};
 j.addEventListener('pointerdown',e=>{id=e.pointerId;j.setPointerCapture(id);set(e);e.preventDefault()});
 j.addEventListener('pointermove',e=>{if(e.pointerId===id)set(e)});
 const end=e=>{if(e.pointerId!==id)return;id=null;k.style.transform='';if(V3)V3.setJoy(0,0)};
 j.addEventListener('pointerup',end);j.addEventListener('pointercancel',end)})();
setTimeout(()=>{const h=$('hint');h.style.opacity=0},9000);
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
