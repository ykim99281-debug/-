/* ===================== 의견 보내기 · 의견함 ===================== */
let lastFeedAt=0;
const FEED_CATS={bug:'🐞 버그',idea:'💡 아이디어',etc:'💬 기타'};
async function sendFeedback(){
  if(user==='guest')return alert('로그인 후 보낼 수 있어요.');
  if(!online||!db)return alert('온라인 연결이 필요해요.');
  const cat=$('fbCat').value,msg=String($('fbMsg').value||'').trim();
  if(!FEED_CATS[cat])return alert('종류를 골라 주세요.');
  if(msg.length<2)return alert('의견을 두 글자 이상 적어 주세요.');
  if(msg.length>400)return alert('의견은 400자까지 보낼 수 있어요.');
  if(Date.now()-lastFeedAt<60000)return alert('조금 있다가 다시 보내 주세요. (1분에 한 번)');
  try{
    const ts=Date.now();
    await dbRef('feedback/'+safeKey(user+'_'+ts)).set({by:user,msg,cat,ts,v:APP_VERSION});
    lastFeedAt=ts;$('fbMsg').value='';alert('의견을 보냈어요. 고마워요! 🙏');
  }catch(e){alert('보내지 못했어요: '+(e.code||e.message))}
}
async function adminFeedList(){
  if(!isAdmin())return alert('권한이 없어요.');
  const box=$('feedList');if(!box)return;
  box.textContent='불러오는 중...';
  try{
    const v=(await dbRef('feedback').get()).val()||{};
    const rows=Object.keys(v).map(k=>({k,...v[k]})).sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,100);
    if(!rows.length){box.textContent='받은 의견이 없어요.';return}
    box.innerHTML='<div style="margin:4px 0">최근 '+rows.length+'개</div>'+rows.map(r=>`<div style="padding:8px;margin:6px 0;border-radius:10px;background:rgba(255,255,255,.07)"><b>${FEED_CATS[r.cat]||'💬'} ${escH(r.by)}</b> <small style="color:#9ca3af">· ${r.ts?new Date(r.ts).toLocaleString():''} · v${escH(r.v||'')}</small><div style="margin:6px 0;white-space:pre-wrap;word-break:break-word">${escH(r.msg)}</div><button class="green" onclick="adminFeedDone('${encodeURIComponent(r.k).replace(/'/g,'%27')}')">✅ 처리(삭제)</button></div>`).join('');
  }catch(e){box.textContent='불러오지 못했어요. ('+(e.code||e.message)+')'}
}
async function adminFeedDone(enc){
  if(!isAdmin())return alert('권한이 없어요.');
  try{await dbRef('feedback/'+decodeURIComponent(enc)).remove();adminFeedList()}
  catch(e){alert('처리하지 못했어요: '+(e.code||e.message))}
}
