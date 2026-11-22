// 의견 보내기·의견함 패치: 계정 탭에 의견 칸, 관리자 패널에 의견함을 끼워 넣어요.
// apply(s)는 자리를 못 찾으면 오류로 멈춰요. (프리미엄 패치가 먼저 적용된 뒤에 써요)
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
exports.apply = function (s) {
  const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('의견 패치 위치 확인 필요: ' + a.slice(0, 60)); s = s.replace(a, () => b); };
  rep('#premBox[data-guest="1"],#blockBox', '#premBox[data-guest="1"],#feedBox[data-guest="1"],#blockBox');
  rep("$('pwBox'),$('premBox'),$('diagBox'),$('blockBox')", "$('pwBox'),$('premBox'),$('feedBox'),$('diagBox'),$('blockBox')");
  rep("for(const id of['pwBox','diagBox','premBox']){", "for(const id of['pwBox','diagBox','premBox','feedBox']){");
  rep('<div class="box" id="diagBox" data-guest="1">', read('feedback-box.html') + '<div class="box" id="diagBox" data-guest="1">');
  rep('  <div class="adminTile ownerOnly">\n    <b>🛡️ 관리자 임명 (제작자 전용)</b>', read('feedback-tile.html') + '  <div class="adminTile ownerOnly">\n    <b>🛡️ 관리자 임명 (제작자 전용)</b>');
  rep("['report','🚨 신고·채팅',['신고 목록','채팅 기록','의심 계정']]", "['report','🚨 신고·채팅',['신고 목록','채팅 기록','의심 계정','의견함']]");
  rep('/* ===================== 비밀번호 변경 ===================== */', read('feedback.js') + '/* ===================== 비밀번호 변경 ===================== */');
  return s;
};
