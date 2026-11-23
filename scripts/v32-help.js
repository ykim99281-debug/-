/* ===================== 알림은 화면 말풍선으로 + 🔌 연결 점검 (알림창이 막힌 브라우저에서도 메시지가 보여요) ===================== */
(function(){
  const box=document.createElement('div');
  box.id='toastBox';box.style.cssText='position:fixed;left:0;right:0;bottom:70px;z-index:2147483000;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;padding:0 12px';
  document.body.appendChild(box);
  window.__toasts=[];
  window.alert=function(m){
    const t=String(m==null?'':m);window.__toasts.push(t);
    const e=document.createElement('div');e.textContent=t;
    e.style.cssText='max-width:520px;width:100%;box-sizing:border-box;padding:12px 16px;border-radius:14px;background:rgba(15,23,42,.97);color:#fff;border:1px solid rgba(250,204,21,.65);box-shadow:0 8px 24px rgba(0,0,0,.6);font-size:15px;line-height:1.55;white-space:pre-line;pointer-events:auto;word-break:keep-all';
    e.onclick=()=>e.remove();box.appendChild(e);
    while(box.children.length>3)box.firstChild.remove();
    setTimeout(()=>e.remove(),Math.min(10000,3200+t.length*70));
  };
})();
// 로그인이 오래 걸리면(연결이 막혔거나 느리면) 알려 줘요
{const _login=login;login=async function(){
  const t=setTimeout(()=>alert('아직 연결 중이에요. 네트워크를 확인하고, 로그인 칸의 🔌 연결 점검을 눌러 보세요.'),8000);
  try{return await _login.apply(this,arguments)}finally{clearTimeout(t)}
}}
async function connCheck(){
  const out=$('connInfo');if(!out)return;
  const L=[];const show=()=>{out.textContent=L.join('\n')};
  out.style.whiteSpace='pre-line';L.push('점검 중...');show();L.length=0;
  L.push('1) 인터넷 도구(Firebase): '+(typeof firebase!=='undefined'?'✅ 불러옴':'❌ 불러오지 못했어요 (인터넷이 막혔거나 광고 차단 앱이 있어요)'));
  L.push('2) 온라인 연결: '+(online?'✅':'❌')+' / 로그인 도구: '+(auth?'✅':'❌'));
  try{L.push('3) 프로젝트: '+firebase.app().options.projectId)}catch(e){L.push('3) 프로젝트: 확인 못 함')}
  show();
  // 로그인 서버에 닿는지 (없는 계정으로 시도 → '계정 없음/비밀번호 틀림' 계열이면 서버에 닿은 거예요)
  try{
    if(!auth)throw new Error('로그인 도구 없음');
    await Promise.race([auth.signInWithEmailAndPassword('check'+Date.now()+'@conn-test.local','x1y2z3w4'),new Promise((_,r)=>setTimeout(()=>r({code:'timeout'}),9000))]);
    L.push('4) 로그인 서버: ✅');
  }catch(e){
    const c=e&&e.code||e&&e.message||'?';
    const reach=/invalid-credential|user-not-found|wrong-password|invalid-email|too-many-requests/.test(c);
    L.push('4) 로그인 서버: '+(reach?'✅ 닿았어요 ('+c+')':'❌ '+c+(c==='timeout'?' (9초 안에 답이 없어요)':'')));
  }
  show();
  // 데이터베이스 연결
  try{
    const ok=await new Promise(res=>{let done=false;const r=db.ref('.info/connected'),h=s=>{if(s.val()===true&&!done){done=true;r.off('value',h);res(true)}};r.on('value',h);setTimeout(()=>{if(!done){r.off('value',h);res(false)}},7000)});
    L.push('5) 데이터베이스: '+(ok?'✅ 연결됨':'❌ 7초 안에 연결되지 않았어요'));
  }catch(e){L.push('5) 데이터베이스: ❌ '+(e.code||e.message))}
  L.push('\n❌가 있으면 그 줄 번호를 알려주세요.');show();
}
setTimeout(()=>{
  try{
    const lb=document.querySelector('button[onclick="login()"]');if(!lb||$('connBtn'))return;
    const b=document.createElement('button');b.id='connBtn';b.textContent='🔌 연결 점검';b.onclick=connCheck;lb.insertAdjacentElement('afterend',b);
    const d=document.createElement('div');d.id='connInfo';d.className='small';d.style.cssText='margin-top:6px';b.insertAdjacentElement('afterend',d);
  }catch(e){}
},300);
