// 하길 공명 연대기(하나님의 길) 판을 만들어요.
// 사용법:  node scripts/make-hagil.js <원본 rpg.html> <만들 hagil.html>
// 원본 코드를 그대로 쓰되, 이름·데이터 위치·로그인 세션·퀴즈를 하길 판으로 바꿔요.
// 바꿀 자리를 못 찾으면 오류로 멈춰요. (원본이 바뀌어서 어긋난 것을 알려 주기 위해서예요)
const fs = require('fs');
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('사용법: node scripts/make-hagil.js <원본 rpg.html> <만들 hagil.html>'); process.exit(1); }
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
rep('<script src="rpg-story.js?v=2.3.0"></script>', '<script src="rpg-story.js?v=2.3.0"></script>\n<script>STORY.title="하길 공명 연대기";</script>');
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

fs.writeFileSync(out, s);
console.log('만들었어요:', out, Math.round(s.length / 1024) + 'KB');
