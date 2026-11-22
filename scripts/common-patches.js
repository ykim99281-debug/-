// 게임 판(하길·건축 …)을 만들 때 공통으로 쓰는 패치: 내 계정 점검 칸 + 프리미엄 1단계
// 사용: s = common.apply(s, { version:'2.6.0', build:260, root:'hagil', titles:[[기본 칭호, 새 칭호], ...] })
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

exports.apply = function (s, o) {
  const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('공통 패치 위치를 못 찾았어요: ' + a.slice(0, 50)); s = s.replace(a, () => b); };
  // 0) PvP 열린 방 목록 + 참가 버튼
  rep('<div id="pvpStatus" class="user">PvP 방 없음</div>', read('pvp-rooms.html') + '<div id="pvpStatus" class="user">PvP 방 없음</div>');
  rep('/* ===================== 비밀번호 변경 ===================== */', read('pvp-rooms.js') + '/* ===================== 비밀번호 변경 ===================== */');
  // 0-1) 이야기 다시 보기
  rep('${open?`<p class="storyText">${escH(c.text)}</p>`:`', '${open?`<p class="storyText">${escH(c.text)}</p><button class="purple" onclick="storyReplay(decodeURIComponent(\'${encodeURIComponent(p.name)}\'))">▶ 이 장 다시 보기</button>`:`');
  rep('<button class="purple" onclick="showPrologue(true)">프롤로그 다시 보기</button>', '<h4>다시 보기</h4><button class="gold" onclick="storyReplay()">▶ 처음부터 이어 보기</button> <button class="purple" onclick="showPrologue(true)">프롤로그 다시 보기</button>');
  rep('/* ===================== 비밀번호 변경 ===================== */', read('story-replay.js') + '/* ===================== 비밀번호 변경 ===================== */');
  // 0-2) 오래된 채팅·신고 기록 정리
  rep('  <div class="adminTile ownerOnly">\n    <b>🛡️ 관리자 임명 (제작자 전용)</b>', read('purge-old.html') + '  <div class="adminTile ownerOnly">\n    <b>🛡️ 관리자 임명 (제작자 전용)</b>');
  rep('/* ===================== 비밀번호 변경 ===================== */', read('purge-old.js') + '/* ===================== 비밀번호 변경 ===================== */');
  // 1) 내 계정 점검 칸
  rep('<div class="box" id="pwBox" data-guest="1">', read('diag-box.html') + '<div class="box" id="pwBox" data-guest="1">');
  rep('/* ===================== 비밀번호 변경 ===================== */', read('diag.js') + '/* ===================== 비밀번호 변경 ===================== */');
  rep('#pwBox[data-guest="1"],#blockBox', '#pwBox[data-guest="1"],#diagBox[data-guest="1"],#blockBox');
  rep("$('pwBox'),$('blockBox')", "$('pwBox'),$('diagBox'),$('blockBox')");
  rep("const pb=$('pwBox');if(pb)pb.dataset.guest=(user==='guest')?'1':''}", "for(const id of['pwBox','diagBox']){const pb=$(id);if(pb)pb.dataset.guest=(user==='guest')?'1':''}}");
  rep("const APP_VERSION='2.4.0',APP_BUILD=240", "const APP_VERSION='" + o.version + "',APP_BUILD=" + o.build);
  // 2) 프리미엄 (칭호 이름만 판 분위기로)
  const theme = t => { for (const [a, b] of o.titles) t = t.split(a).join(b); return t.split('anime/premium').join(o.root + '/premium'); };
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
  // 2-1) 링크 미리보기(공유할 때 나오는 제목·설명·그림)
  if (o.og) {
    const esc = t => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const tags = '\n<meta property="og:type" content="website">\n<meta property="og:title" content="' + esc(o.og.title) + '">\n<meta property="og:description" content="' + esc(o.og.desc) + '">\n<meta property="og:image" content="' + esc(o.og.image) + '">\n<meta property="og:url" content="' + esc(o.og.url) + '">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="description" content="' + esc(o.og.desc) + '">';
    rep('</title>', '</title>' + tags);
  }
  // 2-2) 의견 보내기 · 의견함
  s = require('./feedback-patch').apply(s);
  // 2-3) 재미(타격감·오늘의 목표)·첫 5분(튜토리얼)·이용 기록(통계)
  s = require('./engage-patch').apply(s, o.coin);
  // 2-4) 성장(레벨)·출석·업적·몬스터 패턴
  s = require('./grow-patch').apply(s, o.coin);
  // 2-5) 3.1: 쪽지·쿠폰·스테이지 순위·주간 도전·설정 (어린이 판은 쪽지·순위 없음)
  s = require('./v31-patch').apply(s, { dm: !o.noDm, rank: !o.noRank });
  // 3) PC·모바일 같이 하기 (화면 크기와 상관없는 전투장)
  s = require('./multiscreen-patch').apply(s);
  return s;
};
