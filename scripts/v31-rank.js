/* ===================== 🗼 스테이지 순위 (최고 스테이지) ===================== */
let _bestPushed=0;
function pushBest(){
  try{
    if(user==='guest'||!online||!db||!auth||!auth.currentUser||!save)return;
    const b=Math.max(1,Math.floor(save.best||1));if(b<=_bestPushed)return;
    _bestPushed=b;dbRef('users/'+safeKey(user)).update({best:b}).catch(()=>{});
  }catch(e){}
}
{const _sc4=onStageClear;onStageClear=function(){const r=_sc4.apply(this,arguments);try{setTimeout(pushBest,400)}catch(e){}return r}}
{const _fl2=finishLogin;finishLogin=async function(n,uid){_bestPushed=0;const r=await _fl2(n,uid);try{setTimeout(pushBest,1500)}catch(e){}return r}}
async function loadStageRank(){
  const box=$('stageRankList');if(!box)return;
  if(user==='guest'||!online||!db){box.textContent='로그인하면 순위를 볼 수 있어요.';return}
  box.textContent='불러오는 중...';
  try{
    let v;
    try{v=(await dbRef('users').orderByChild('best').limitToLast(30).get()).val()||{}}
    catch(e1){v=(await dbRef('users').get()).val()||{}}
    const list=Object.keys(v).map(n=>({n,best:Number(v[n]&&v[n].best)||0,char:(v[n]&&v[n].char)||''})).filter(x=>x.best>0).sort((a,b)=>b.best-a.best).slice(0,30);
    if(!list.length){box.textContent='아직 순위가 없어요. 전투에서 이기면 기록돼요!';return}
    const my=list.findIndex(x=>x.n===user);
    box.innerHTML=`<div style="margin:6px 0">내 순위: <b>${my>=0?(my+1)+'위':'30위 밖'}</b> · 내 최고 ${save.best||1}스테이지</div>`+list.map((x,i)=>`<div style="display:flex;gap:8px;align-items:center;padding:6px 8px;margin:4px 0;border-radius:8px;background:${x.n===user?'rgba(250,204,21,.18)':'rgba(255,255,255,.07)'}"><span style="width:28px;text-align:center">${i<3?['🥇','🥈','🥉'][i]:(i+1)}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${adminLabel(x.n)}<br><small style="color:#9ca3af">${escH(x.char)}</small></span><b>${x.best}스테이지</b></div>`).join('');
  }catch(e){box.textContent='순위를 불러오지 못했어요. ('+(e.code||e.message)+')'}
}
