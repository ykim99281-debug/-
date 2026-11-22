/* ===================== 내 계정 점검 ===================== */
async function runDiag(){
  const o=$('diagOut'),L=[];
  const out=()=>{o.textContent=L.join('\n')};
  L.push('버전: '+APP_VERSION+' (빌드 '+APP_BUILD+')');
  L.push('게임 닉네임: '+user);
  const cu=auth&&auth.currentUser;
  L.push('로그인 UID: '+(cu?cu.uid:'(로그인 안 됨)'));
  L.push('내 권한(myAdminRole): '+(myAdminRole||'(없음)'));
  L.push('직급(rankOf): '+(rankOf(user)||'(없음)'));
  L.push('관리자 패널 버튼: '+(hasRank()?'보여야 함':'숨김'));
  out();
  if(!cu||!db)return;
  try{L.push('names/'+user+' 값: '+JSON.stringify((await dbRef('names/'+safeKey(user)).get()).val()))}catch(e){L.push('names 읽기 오류: '+(e.code||e.message))}
  try{L.push('uids/내UID 값: '+JSON.stringify((await dbRef('uids/'+cu.uid).get()).val()))}catch(e){L.push('uids 읽기 오류: '+(e.code||e.message))}
  try{L.push('admins/내UID 값: '+JSON.stringify((await dbRef('admins/'+cu.uid).get()).val()))}catch(e){L.push('admins 읽기 오류: '+(e.code||e.message))}
  out();
}
async function copyMyUid(){
  const cu=auth&&auth.currentUser;if(!cu)return alert('로그인 후 사용할 수 있어요.');
  try{await navigator.clipboard.writeText(cu.uid);alert('UID를 복사했어요.')}catch(e){prompt('이 UID를 복사하세요',cu.uid)}
}

