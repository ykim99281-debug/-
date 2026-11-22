/* ===================== 오래된 채팅·신고 기록 정리 (보관 기간이 지난 것 삭제) ===================== */
async function adminPurgeOld(doIt){
  if(!isAdmin())return alert('권한이 없어요.');
  const days=Math.floor(Number($('purgeDays').value)),box=$('purgeInfo');
  if(!Number.isFinite(days)||days<30||days>3650)return alert('보관 기간은 30~3650일로 입력해 주세요.');
  const cutoff=Date.now()-days*864e5;
  let chat,reps;
  try{chat=(await dbRef('globalChat').get()).val()||{};reps=(await dbRef('reports').get()).val()||{}}
  catch(e){return alert('기록을 불러오지 못했어요: '+(e.code||e.message))}
  const old=(o)=>Object.keys(o).filter(k=>{const t=Number(o[k]&&o[k].ts);return t>0&&t<cutoff});
  const oc=old(chat),or=old(reps);
  const ds=ks=>ks.length?' (가장 오래된 것: '+new Date(Math.min(...ks.map(k=>Number((ks===oc?chat:reps)[k].ts)))).toLocaleDateString()+')':'';
  const txt='채팅 '+oc.length+'개'+ds(oc)+', 신고 '+or.length+'개'+ds(or)+' ('+days+'일이 지난 기록)';
  if(box)box.textContent=txt;
  if(!doIt)return;
  if(!oc.length&&!or.length)return alert('지울 기록이 없어요.');
  if(!confirm(txt+'\n\n정말 지울까요? 되돌릴 수 없어요.'))return;
  let done=0;
  try{
    for(const [name,ks] of [['globalChat',oc],['reports',or]]){
      for(let i=0;i<ks.length;i+=200){
        const part={};ks.slice(i,i+200).forEach(k=>{part[k]=null});
        await dbRef(name).update(part);done+=Math.min(200,ks.length-i);
        if(box)box.textContent='지우는 중... '+done+' / '+(oc.length+or.length);
      }
    }
  }catch(e){if(box)box.textContent='중간에 멈췄어요('+done+'개 삭제): '+(e.code||e.message);return alert('지우지 못했어요: '+(e.code||e.message))}
  if(box)box.textContent='✅ '+done+'개를 지웠어요.';
  alert(done+'개를 지웠어요.');
}
