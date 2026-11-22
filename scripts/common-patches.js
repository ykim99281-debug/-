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
  return s;
};
