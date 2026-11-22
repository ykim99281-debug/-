// 하길 공명 연대기(하나님의 길) 판을 만들어요.
// 사용법:  node scripts/make-hagil.js [원본 html] [만들 hagil.html]
//   (인자를 생략하면 scripts/base/rpg-2.4.0.html → hagil.html)
// 원본 코드를 그대로 쓰되, 이름·데이터 위치·로그인 세션·퀴즈와 캐릭터·보스·지역·이야기(하나님의 길)를 하길 판으로 바꿔요.
// 바꿀 자리를 못 찾으면 오류로 멈춰요. (원본이 바뀌어서 어긋난 것을 알려 주기 위해서예요)
const fs = require('fs');
const path = require('path');
const [src = path.join(__dirname, 'base', 'rpg-2.4.0.html'), out = path.join(__dirname, '..', 'hagil.html')] = process.argv.slice(2);
let s = fs.readFileSync(src, 'utf8');

function rep(a, b, expect) {
  const n = s.split(a).length - 1;
  if (n < 1 || (expect && n !== expect)) throw new Error('찾지 못했거나 개수가 달라요(' + n + '개): ' + a.slice(0, 70));
  s = s.split(a).join(b);
}

// 1) 이름
rep('<title>별빛 공명 연대기</title>', '<title>하길 공명 연대기</title>');
rep('꺼진 별을 다시 켜는 공명의 여정', '하나님의 길을 따라 걷는 공명의 여정');
rep('별빛 공명 연대기', '하길 공명 연대기');
// 2) 퀴즈를 성경·교회 문제로
rep('<script src="rpg-quiz.js?v=2.4.0"></script>', '<script src="hagil-quiz.js?v=1"></script>');
rep('<script src="rpg-story.js?v=2.3.0"></script>', '<script src="hagil-story.js?v=1"></script>');
// 3) 데이터는 하길 전용 위치(hagil/)에 저장
rep("function dbRef(p){return db.ref('anime/'+p)}", "function dbRef(p){return db.ref('hagil/'+p)}", 1);
// 4) 로그인 계정은 별빛 판과 완전히 별개 (같은 닉네임이어도 따로 가입)
rep("cyrb128('anime-rpg:'+n)", "cyrb128('hagil-rpg:'+n)", 1);
rep("+'@anime-rpg.local'", "+'@hagil-rpg.local'", 1);
// 5) 로그인 세션도 따로 (이름을 붙인 별도 Firebase 앱)
rep("if(!firebase.apps.length)fbApp=firebase.initializeApp(DEFAULT_FIREBASE_CONFIG);else fbApp=firebase.app();\n    db=firebase.database();auth=firebase.auth();",
    "fbApp=firebase.apps.find(a=>a.name==='hagil')||firebase.initializeApp(DEFAULT_FIREBASE_CONFIG,'hagil');\n    db=firebase.database(fbApp);auth=firebase.auth(fbApp);", 1);
rep("firebase.app().functions(FUNCTIONS_REGION)", "firebase.app('hagil').functions(FUNCTIONS_REGION)", 1);
// 6) 브라우저 저장소 이름표도 따로
for (const k of ['rpgSave_', 'rpgCharImg_', 'rpgInvite_', 'rpgTradeInvite_', 'rpgTradeRoom_', 'rpgFriendMail_', 'bgPrologueSeen', 'bgChap_']) {
  if (s.includes(k)) s = s.split(k).join(k.replace(/^(rpg|bg)/, 'hg'));
}
// 7) 앱 설치(PWA)·공유 미리보기는 별빛 판 전용이라 빼요
s = s.replace(/<link rel="manifest"[^>]*>\n?/, '').replace(/<meta property="og:[^>]*>\n?/g, '');
s = s.replace(/\nif\('serviceWorker' in navigator[^\n]*\n/, '\n');
// 8) 서버 모드는 별빛 판만 지원 (서버 함수가 별빛 판 데이터 위치를 쓰므로 섞이면 안 돼요)
const tail = 'norm();renderAll();setTimeout(()=>{let pc=$("photoChar")';
rep(tail, 'SERVER=function(){return false};\nadminServerModeOn=function(){alert("하길 판에서는 서버 모드를 지원하지 않아요.")};\nadminSetServerUrl=function(){alert("하길 판에서는 서버 주소를 쓰지 않아요.")};\n' + tail, 1);
rep("<div class=\"small\">점검 중에는", "<div class=\"small\">(하길 판은 서버 모드를 지원하지 않아요) 점검 중에는", 1);


// ===================================================================
// 하나님의 길 테마: 캐릭터·보스·지역·진영·용어를 성경 중심으로
// ===================================================================
// 1) 지역(월드맵)
for (const [a, b] of [
  ['새벽별 언덕 입구', '베들레헴 들판'], ['거미줄 협곡', '엘라 골짜기'], ['등불 항구도시', '욥바 항구'], ['북소리 저택', '여리고 성벽'],
  ['별빛 급행열차', '방주 안'], ['홍등 불야성', '소돔과 고모라'], ['대장장이 마을', '성막 공방'], ['공허 성채', '바벨 성채'],
  ['각성자 학원', '예루살렘 성전'], ['네온 구역', '바벨론 거리'], ['순환 결계', '광야 사십 년'], ['공허 군주 레이드', '죄의 군주 레이드'],
  ['카오스의 성역', '금 신상의 성역'], ['오블리비온 최종전', '대적자 최종전'],
  ['거미 공허체 지역', '올무의 어둠 지역'], ['북의 공허 고수 지역', '바알 제사장 지역'], ['꿈 공허체 보스 지역', '거짓 평안 보스 지역'],
  ['공허 6좌 지역', '탐욕의 군주 지역'], ['공허 군주 집결 지역', '죄의 군주 집결 지역'], ['각성자 시작 지역', '천사와 사도 모임 지역'],
  ['각성자 대형 전투 지역', '도시 대형 전투 지역'], ['고난도 술식 지역', '고난도 시험 지역'], ['공허 군주 보스 레이드', '죄의 군주 보스 레이드'],
  ['최상위 각성자 보스', '우상의 왕 보스'],
]) rep(a, b);
rep('place.name.includes("오블리비온") || place.name.includes("카오스") || place.name.includes("레이드")', 'place.name.includes("대적자") || place.name.includes("금 신상") || place.name.includes("레이드")', 1);

// 2) 보스(demons)
const demons = '[["죄의 수렁","🕳️","#14532d"],["바알의 제사장","🥁","#7c2d12"],["죄의 올무","🕷️","#64748b"],["거짓 평안의 꿈","💤","#7e22ce"],["탐욕의 군주 맘몬","☠️","#166534"],["교만의 군주 바벨","🏺","#0891b2"],["시기의 군주 가인","👺","#a16207"],["박해자 사울","👊","#dc2626"],["일곱 귀신의 사슬","❄️","#38bdf8"],["밤의 바리새인","🌙","#9333ea"],["어둠의 대적자","🩸","#7f1d1d"],["금 신상의 왕","⛩️","#dc2626"],["거인 골리앗","♾️","#38bdf8"],["교활한 하만","🌑","#6d28d9"],["군대 귀신 레기온","⚔️","#b91c1c"],["바다의 괴물 리워야단","🌋","#ea580c"]]';
s = s.replace(/const demons=\[.*?\];/, 'const demons=' + demons + ';');

// 3) 장비 이름
rep('기사단 갑옷', '믿음의 갑옷'); rep('공허 사냥꾼 세트', '하나님의 전신 갑주');

// 4) 캐릭터: [기존 이름, 새 이름, 진영, 속성(표시), 기술2개]
const C = [
  ['하루 세이렌', '다윗', '용사', '물/태양', ['물맷돌 일격', '찬양의 노래']],
  ['라이언 볼트', '요나단', '용사', '번개', ['신속한 화살', '우정의 맹세']],
  ['가루 브루트', '삼손', '용사', '짐승', ['사자 가르기', '마지막 힘']],
  ['미라 에코', '노아', '용사', '물', ['방주의 물결', '무지개의 약속']],
  ['플로라 벨', '에스더', '용사', '꽃', ['왕비의 결단', '죽으면 죽으리이다']],
  ['카이 아쿠아', '사무엘', '선지자', '물', ['기름 부음', '고요한 음성']],
  ['솔 이그니스', '엘리야', '선지자', '화염', ['갈멜산의 불', '불 병거']],
  ['나비아 실크', '요엘', '선지자', '벌레', ['메뚜기 떼의 경고', '성령의 부으심']],
  ['에이든 바르도', '여호수아', '선지자', '소리', ['여리고의 나팔', '강하고 담대하라']],
  ['미스트 루벤', '모세', '선지자', '안개', ['구름 기둥', '홍해를 가른 지팡이']],
  ['로제 하트', '룻', '선지자', '사랑', ['끝까지 함께', '이삭줍기의 은혜']],
  ['윈드 칼리스', '에스겔', '선지자', '바람', ['마른 뼈의 바람', '성령의 숨']],
  ['그란 록하트', '베드로', '선지자', '바위', ['반석 방패', '천국의 열쇠']],
  ['세르펜 이오', '아론', '선지자', '뱀', ['지팡이가 뱀이 되다', '제사장의 축복']],
  ['루비아 엠버', '라합', '회개자', '회개의 힘', ['붉은 줄의 표시', '믿음의 용기']],
  ['그라스 타이탄', '바울', '회개자', '변화의 힘', ['다메섹의 빛', '이방인의 사도']],
  ['프로스트 모르가', '막달라 마리아', '회개자', '자유의 힘', ['부활의 첫 증인', '향유를 붓다']],
  ['루나 녹티스', '니고데모', '회개자', '밤/회개의 힘', ['밤의 질문', '다시 태어남']],
  ['오블리비온', '삭개오', '회개자', '회개의 힘', ['네 배로 갚으리라', '뽕나무 위의 만남']],
  ['토라 브레이커', '가브리엘', '천사', '천상의 힘', ['기쁜 소식 전하기', '나팔 소리']],
  ['아스트라 인피니', '미가엘', '천사', '천군', ['하늘 군대의 인도', '용을 물리치는 검']],
  ['카오스 렉스', '세라핌', '천사', '거룩한 불', ['거룩 거룩 거룩', '숯불의 정결']],
  ['리온 에리스', '수호 천사', '천사', '수호', ['곁을 지키는 날개', '역전의 빛']],
  ['네로 쉐도우', '그룹', '천사', '파수', ['불 칼의 파수', '에덴의 문지기']],
  ['레오 칼라일', '나팔 천사', '천사', '나팔', ['일곱째 나팔', '새벽 경계']],
  ['모르페우스', '평화의 천사', '천사', '평강', ['평강의 선포', '두려워 말라']],
  ['레이나 블래스트', '나아만', '나그네', '희귀', ['요단강 일곱 번', '나병이 낫다']],
  ['잭 리볼버', '고넬료', '나그네', '희귀', ['백부장의 기도', '성령이 임하다']],
  ['카투스 가시', '사렙다 과부', '나그네', '희귀', ['끝나지 않는 기름', '믿음의 대접']],
  ['카멜레 쉐이드', '에티오피아 관리', '나그네', '희귀', ['이사야 두루마리', '물가의 세례']],
];
// 4-1) 기존 이름 → 새 이름 (여러 단어 이름은 전체 바꾸기, 한 단어 이름은 캐릭터 이름 칸만)
const multi = C.filter(c => c[0].includes(' '));
for (const [o, n] of multi) { if (!s.includes(o)) throw new Error('이름을 못 찾았어요: ' + o); s = s.split(o).join(n); }
for (const [o, n] of C.filter(c => !c[0].includes(' '))) { rep('name:"' + o + '"', 'name:"' + n + '"', 1); }
// 4-2) 진영·속성·기술
for (const [, n, side, br, sk] of C) {
  const re = new RegExp('(\\{name:"' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '",)side:"[^"]*"(,emoji:"[^"]*",)breath:"[^"]*"(.*?)skill:\\[[^\\]]*\\]');
  const m = s.match(re); if (!m) throw new Error('캐릭터 줄을 못 찾았어요: ' + n);
  s = s.replace(re, m[1] + 'side:"' + side + '"' + m[2] + 'breath:"' + br + '"' + m[3] + 'skill:[' + sk.map(x => '"' + x + '"').join(',') + ']');
}
// 4-3) 코드 속 이름 판별 글자(특수 연출·그림 모양) → 새 이름
for (const [a, b] of [['아스트라', '미가엘'], ['카오스', '세라핌'], ['토라', '가브리엘'], ['이그니스', '엘리야'], ['세이렌', '다윗'], ['엠버', '라합'],
  ['볼트', '요나단'], ['브루트', '삼손'], ['실크', '요엘'], ['오블리비온', '대적자'], ['블래스트', '나아만'], ['리볼버', '고넬료'], ['가시', '사렙다'], ['쉐이드', '에티오피아']]) {
  s = s.split(a).join(b);
}
// 5) 진영 이름(코드 속 비교 글자와 필터 버튼)
for (const [a, b] of [['공허군', '회개자'], ['각성자', '천사'], ['용병단', '나그네'], ['수호좌', '선지자'], ['기사단', '용사']]) s = s.split(a).join(b);
// 6) 용어
for (const [a, b] of [['일반 공허체', '일반 어둠의 세력'], ['공허체', '어둠의 세력']]) s = s.split(a).join(b);
s = s.split('"공허술"]').join('"회개"]').split('회개자 공허술').join('회개자 회개');
// 7) 그림 색 표의 속성 이름
for (const [a, b] of [['"공허술":[', '"회개의 힘":['], ['"파쇄술":[', '"변화의 힘":['], ['"빙결 공허술":[', '"자유의 힘":['], ['"달/공허술":[', '"밤/회개의 힘":['], ['"마력":[', '"천상의 힘":['],
  ['"무한":[', '"천군":['], ['"혼돈":[', '"거룩한 불":['], ['"수호령":[', '"수호":['], ['"그림자 소환":[', '"파수":['], ['"황금비":[', '"나팔":['], ['"영혼 지배":[', '"평강":[']]) {
  if (s.includes(a)) s = s.split(a).join(b);
}
// 8) 연출 문구
for (const [a, b] of [['星界解放', '하늘의 군대'], ['魔力解放', '천사의 능력'], ['虛術', '悔改'], ['無限星界', '天軍'], ['混沌聖域', '聖火'], ['무한 성계', '미가엘의 검'], ['혼돈 성역', '거룩한 불'],
  ['👹 처치 보너스 퀴즈', '📖 처치 보너스 성경 퀴즈']]) { if (s.includes(a)) s = s.split(a).join(b); }

// 10) 하길: 코인 대신 "점수", 점수 순위표 (PvP 점수는 "승점"으로 이름을 나눠요)
{
  const rep = (a, b, all) => { const n = s.split(a).length - 1; if (n < 1 || (!all && n !== 1)) throw new Error('점수 패치 위치 확인 필요(' + n + '곳): ' + a.slice(0, 40)); s = s.split(a).join(b); };
  // PvP 점수 → 승점
  rep('현재 PvP 점수 ${save.pvp||0}점', '현재 PvP 승점 ${save.pvp||0}점');
  rep('<b>점수 규칙</b>', '<b>승점 규칙</b>');
  rep('진 사람의 점수를 <b>', '진 사람의 승점을 <b>');
  rep('퀴즈 상자에서도 랭크 점수를 얻을 수 있어요', '퀴즈 상자에서도 승점을 얻을 수 있어요');
  rep('`랭크 점수 +${r.score}`', '`승점 +${r.score}`');
  rep('내 점수 ${save.pvp||0}', '내 승점 ${save.pvp||0}');
  rep("'점수 '+(delta", "'승점 '+(delta", true);
  rep('점수가 바뀌지', '승점이 바뀌지');
  // 코인 → 점수
  s = s.replace(/([0-9}])코인/g, '$1 점수'); // 숫자 뒤는 띄어 써요 (1000 점수)
  rep('코인', '점수', true);
  // 순위표 버튼
  rep('<h3>🏆 랭킹</h3>', '<h3>🏆 순위표</h3>');
  rep('<button class="blue" onclick="loadRanking()">랭킹 새로고침</button>', '<button class="blue" onclick="loadRanking()">🏅 승점 순위</button> <button class="gold" onclick="loadScoreRanking()">⭐ 점수 순위</button>');
  // 누적 점수를 users 기록에 함께 저장
  rep('pvp:save.pvp||0,', 'pvp:save.pvp||0,score:save.total||0,', true);
  // 승점 주간 초기화: users 기록에 이번 주 번호(pw)를 같이 저장하고, 순위표는 이번 주 사람만 보여요
  rep('pvp:save.pvp||0,score:save.total||0,', 'pvp:save.pvp||0,pw:save.pw||0,score:save.total||0,', true);
  rep("(await dbRef('users').orderByChild('pvp').limitToLast(30).get()).val()||{}", "(await dbRef('users').orderByChild('pw').equalTo(pvpWeekNow()).get()).val()||{}");
  rep('.sort((a,b)=>b.pvp-a.pvp);', '.filter(x=>x.pvp>0).sort((a,b)=>b.pvp-a.pvp).slice(0,30);');
  rep('<br><span id="rankTierInfo"></span>', '<br>· 승점은 <b>매주 월요일 0시(한국시간)</b>에 모두 0으로 초기화돼요 <span id="weekLeft"></span><br><span id="rankTierInfo"></span>');
  rep("  box.textContent='불러오는 중...';\n  try{\n    const v=(await dbRef('users').orderByChild('pw')", "  box.textContent='불러오는 중...';updateWeekLeft();\n  try{\n    const v=(await dbRef('users').orderByChild('pw')");
  // 누적 점수 + 점수 순위표 코드
  rep('SERVER=function(){return false};', fs.readFileSync(path.join(__dirname, 'hagil-score.js'), 'utf8') + fs.readFileSync(path.join(__dirname, 'hagil-weekly.js'), 'utf8') + 'SERVER=function(){return false};');
}

// 9) 내 계정 점검 칸 (별빛 2.3.1과 같은 도구)
{
  const box = fs.readFileSync(path.join(__dirname, 'diag-box.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, 'diag.js'), 'utf8');
  const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('진단 패치 위치를 못 찾았어요: ' + a.slice(0, 40)); s = s.replace(a, () => b); };
  rep('<div class="box" id="pwBox" data-guest="1">', box + '<div class="box" id="pwBox" data-guest="1">');
  rep('/* ===================== 비밀번호 변경 ===================== */', js + '/* ===================== 비밀번호 변경 ===================== */');
  rep('#pwBox[data-guest="1"],#blockBox', '#pwBox[data-guest="1"],#diagBox[data-guest="1"],#blockBox');
  rep("$('pwBox'),$('blockBox')", "$('pwBox'),$('diagBox'),$('blockBox')");
  rep("const pb=$('pwBox');if(pb)pb.dataset.guest=(user==='guest')?'1':''}", "for(const id of['pwBox','diagBox']){const pb=$(id);if(pb)pb.dataset.guest=(user==='guest')?'1':''}}");
  rep("const APP_VERSION='2.4.0',APP_BUILD=240", "const APP_VERSION='2.6.0',APP_BUILD=260");
}

// 11) 프리미엄 1단계 (별빛 2.5.0과 같은 기능, 칭호 이름만 하길 분위기로)
{
  const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
  const TITLES = [['🌱 개척자', '🌱 믿음의 개척자'], ['💎 후원자', '🕊️ 평화의 사람'], ['✨ 별빛 수호자', '✝️ 길의 수호자'], ['🏅 베테랑', '📖 말씀의 사람']];
  const theme = t => { for (const [a, b] of TITLES) t = t.split(a).join(b); return t.split('anime/premium').join('hagil/premium'); };
  const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('프리미엄 패치 위치 확인 필요: ' + a.slice(0, 50)); s = s.replace(a, () => b); };
  rep('#pwBox[data-guest="1"],#diagBox[data-guest="1"],#blockBox', '#pwBox[data-guest="1"],#diagBox[data-guest="1"],#premBox[data-guest="1"],#blockBox');
  rep('.adminTile.adminHide{display:none!important}', '.adminTile.adminHide{display:none!important}\n.premTitle{display:inline-block;margin-left:4px;padding:1px 6px;border-radius:999px;font-size:10px;background:rgba(250,204,21,.18);color:#fde68a;border:1px solid rgba(250,204,21,.4)}\n.swatch{width:30px;height:30px;border-radius:50%;border:2px solid rgba(255,255,255,.25);padding:0;margin:3px}\n.swatch.on{border-color:#fff;box-shadow:0 0 8px #fff}');
  rep('<div class="box" id="diagBox" data-guest="1">', theme(read('prem-box.html')) + '<div class="box" id="diagBox" data-guest="1">');
  rep("$('pwBox'),$('diagBox'),$('blockBox')", "$('pwBox'),$('premBox'),$('diagBox'),$('blockBox')");
  rep("for(const id of['pwBox','diagBox']){", "for(const id of['pwBox','diagBox','premBox']){");
  rep('  <div class="adminTile ownerOnly">\n    <b>🛡️ 관리자 임명 (제작자 전용)</b>', theme(read('prem-tile.html')) + '  <div class="adminTile ownerOnly">\n    <b>🛡️ 관리자 임명 (제작자 전용)</b>');
  rep("['give','🎁 지급',['내 보상','특정 유저 지급','전체 유저 보상']]", "['give','🎁 지급',['내 보상','특정 유저 지급','전체 유저 보상','프리미엄']]");
  { const n = s.split('`<span class="chatName">${safeName}</span>`').length - 1; if (n < 1) throw new Error('채팅 이름 위치 없음'); s = s.split('`<span class="chatName">${safeName}</span>`').join('premLabel(safeName)'); }
  rep("  add(dbRef('mutes'),s=>{muteMap=s.val()||{}});", "  add(dbRef('mutes'),s=>{muteMap=s.val()||{}});\n  add(dbRef('premium'),s=>{premiumMap=s.val()||{};renderPremium()});");
  rep('/* ===================== 내 계정 점검 ===================== */', theme(read('prem.js')) + '/* ===================== 내 계정 점검 ===================== */');
}

fs.writeFileSync(out, s);
console.log('만들었어요:', out, Math.round(s.length / 1024) + 'KB');
