/* ===================== 🎟️ 쿠폰: 관리자가 코드를 만들고, 유저가 한 번씩 받아요 ===================== */
const CP_RE=/^[A-Z0-9]{4,16}$/;
const cpNorm=t=>String(t||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,16);
async function redeemCoupon(){
  if(user==='guest')return alert('로그인 후 쓸 수 있어요.');
  if(!online||!db)return alert('온라인 연결이 필요해요.');
  if(typeof SERVER==='function'&&SERVER())return alert('서버 모드에서는 쿠폰이 잠시 쉬어요.');
  const code=cpNorm($('couponCode').value);
  if(!CP_RE.test(code))return alert('쿠폰 코드를 확인해 주세요. (영문 대문자와 숫자 4~16자)');
  let cp;
  try{cp=(await dbRef('coupons/'+code).get()).val()}catch(e){return alert('쿠폰을 확인하지 못했어요: '+(e.code||e.message))}
  if(!cp)return alert('없는 쿠폰이에요.');
  if(!(cp.endsAt>Date.now()))return alert('기간이 끝난 쿠폰이에요.');
  try{await dbRef('couponClaims/'+code+'/'+safeKey(user)).set(true)}
  catch(e){return alert('이미 받았거나 받을 수 없는 쿠폰이에요.')}
  const c=Math.max(0,Math.min(1000000,Math.floor(cp.coins||0))),d=Math.max(0,Math.min(200,Math.floor(cp.dia||0)));
  coins+=c;dia+=d;save.coins=coins;save.dia=dia;store();sfx('coin');$('couponCode').value='';
  alert('🎁 쿠폰 선물! '+(c?c+' '+CUR2+' ':'')+(d?'다이아 '+d:''));
}
function cpAuto(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<8;i++)s+=A[Math.floor(Math.random()*A.length)];return s}
async function adminCouponMake(){
  if(!isAdmin())return alert('권한이 없어요.');
  let code=cpNorm($('cpCode').value)||cpAuto();
  const c=Math.floor(Number($('cpCoins').value)||0),d=Math.floor(Number($('cpDia').value)||0),days=Math.floor(Number($('cpDays').value));
  if(!CP_RE.test(code))return alert('코드는 영문 대문자와 숫자 4~16자예요.');
  if(c<0||c>1000000||d<0||d>200)return alert('코인은 0~1,000,000, 다이아는 0~200으로 적어 주세요.');
  if(c===0&&d===0)return alert('코인이나 다이아 중 하나는 있어야 해요.');
  if(!Number.isFinite(days)||days<1||days>365)return alert('유효 기간은 1~365일이에요.');
  try{
    if((await dbRef('coupons/'+code).get()).exists())return alert('이미 있는 코드예요. 다른 코드를 써 주세요.');
    await dbRef('coupons/'+code).set({coins:c,dia:d,endsAt:Date.now()+days*864e5,by:user,ts:Date.now()});
    $('cpInfo').innerHTML='✅ 만들었어요! 쿠폰 코드: <b style="font-size:18px;color:#fde047">'+code+'</b> ('+days+'일 동안)';
    $('cpCode').value='';
  }catch(e){alert('만들지 못했어요: '+(e.code||e.message))}
}
async function adminCouponList(){
  if(!isAdmin())return alert('권한이 없어요.');
  const box=$('cpInfo');box.textContent='불러오는 중...';
  try{
    const [cs,cl]=await Promise.all([dbRef('coupons').get(),dbRef('couponClaims').get()]);
    const cps=cs.val()||{},claims=cl.val()||{},keys=Object.keys(cps).sort((a,b)=>(cps[b].ts||0)-(cps[a].ts||0)).slice(0,50);
    if(!keys.length){box.textContent='만든 쿠폰이 없어요.';return}
    box.innerHTML=keys.map(k=>{const x=cps[k],on=x.endsAt>Date.now(),n=Object.keys(claims[k]||{}).length;return `<div style="padding:6px 8px;margin:4px 0;border-radius:8px;background:rgba(255,255,255,.07)"><b>${escH(k)}</b> ${on?'🟢':'⚪ 만료'} · ${x.coins||0} ${CUR2} / 다이아 ${x.dia||0} · 받은 사람 ${n}명 · ~${new Date(x.endsAt).toLocaleDateString()} <button class="red" onclick="adminCouponDel('${escH(k)}')">삭제</button></div>`}).join('');
  }catch(e){box.textContent='불러오지 못했어요. ('+(e.code||e.message)+')'}
}
async function adminCouponDel(code){
  if(!isAdmin()||!CP_RE.test(code))return;
  if(!confirm(code+' 쿠폰을 삭제할까요?'))return;
  try{await dbRef('coupons/'+code).remove();adminCouponList()}catch(e){alert('삭제하지 못했어요: '+(e.code||e.message))}
}
