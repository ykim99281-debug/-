/* ===================== 하길: 점수(누적) 순위표 ===================== */
// 점수를 얻은 만큼만 누적해요(쓰면 줄어들지 않아요). 순위표는 이 누적 점수로 매겨요.
{const _storeTot=store;store=function(){
  const c=Number(coins)||0;
  if(save.lc===undefined)save.lc=c;
  if(save.total===undefined)save.total=c;
  if(c>save.lc)save.total+=c-save.lc;
  save.lc=c;
  _storeTot();
}}
async function loadScoreRanking(){
  const box=$('rankingList');if(!box)return;
  if(user==='guest'||!online||!db){box.textContent='로그인하면 순위표를 볼 수 있어요';return}
  box.textContent='불러오는 중...';
  try{
    const v=(await dbRef('users').orderByChild('score').limitToLast(30).get()).val()||{};
    const list=Object.keys(v).map(n=>({n,score:Number(v[n].score)||0,char:v[n].char||''})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    if(!list.length){box.textContent='아직 점수 순위가 없어요';return}
    const myIdx=list.findIndex(x=>x.n===user);
    box.innerHTML=`<div style="margin:6px 0">⭐ 점수 순위(누적) · 내 순위: <b>${myIdx>=0?(myIdx+1)+'위':'30위 밖'}</b> · 내 누적 점수 ${(save.total||0).toLocaleString()}</div>`+list.map((x,i)=>`<div class="rkRow ${x.n===user?'me':''}"><span class="rkNo">${i<3?['🥇','🥈','🥉'][i]:(i+1)}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${adminLabel(x.n)}<br><small style="color:#9ca3af">${escH(x.char)}</small></span><span style="text-align:right"><b>${x.score.toLocaleString()}</b>점</span></div>`).join('');
  }catch(e){box.textContent='순위표를 불러오지 못했어요.'}
}
