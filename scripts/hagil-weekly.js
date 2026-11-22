/* ===================== 하길: PvP 승점 주간 초기화 (매주 월요일 0시, 한국시간) ===================== */
const WEEK_MS=7*864e5,WEEK_OFF=4*864e5-9*36e5; // 1970-01-05(월) 0시 KST 기준
function pvpWeekNow(){return Math.floor((Date.now()-WEEK_OFF)/WEEK_MS)}
function pvpWeekEnd(){return (pvpWeekNow()+1)*WEEK_MS+WEEK_OFF}
function weekLeftText(){
  const ms=Math.max(0,pvpWeekEnd()-Date.now()),d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);
  let t='(초기화까지 '+(d?d+'일 ':'')+h+'시간 '+m+'분)';
  if(save&&save.lastWeek)t+=' · 지난주 최종 '+save.lastWeek.pvp+'점 ('+save.lastWeek.tier+')';
  return t;
}
function updateWeekLeft(){const e=$('weekLeft');if(e)e.textContent=weekLeftText()}
function pvpWeekCheck(){
  if(user==='guest'||!save)return;
  const w=pvpWeekNow();
  if(save.pw===w)return;
  if(save.pw===undefined){save.pw=w;try{store()}catch(e){}return} // 처음엔 이번 주로 시작
  const last=save.pvp||0,tier=rankNameByScore(last);
  save.lastWeek={w:save.pw,pvp:last,tier};
  save.pw=w;save.pvp=0;
  try{store()}catch(e){}
  updateWeekLeft();
  setTimeout(()=>alert('🗓️ 새 주가 시작됐어요!\n지난주 최종 승점 '+last+'점 ('+tier+') · 승점이 0으로 초기화됐어요.'),50);
}
{const _fl=finishLogin;finishLogin=async function(n,uid){const r=await _fl(n,uid);try{pvpWeekCheck()}catch(e){}return r}}
setInterval(()=>{try{pvpWeekCheck();updateWeekLeft()}catch(e){}},30000);
setTimeout(updateWeekLeft,500);
