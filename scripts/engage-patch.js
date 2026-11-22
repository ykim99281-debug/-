// 재미·첫 5분·통계 패치: 홈 탭에 "오늘의 목표", 관리자 패널에 "통계", 튜토리얼·타격감·이용 기록 코드를 끼워 넣어요.
// apply(s, coinName)는 자리를 못 찾으면 오류로 멈춰요. (의견 패치가 먼저 적용된 뒤에 써요)
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
exports.apply = function (s, coinName) {
  const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('재미 패치 위치 확인 필요: ' + a.slice(0, 60)); s = s.replace(a, () => b); };
  rep("<div class=\"filters\"><button class=\"active\" onclick=\"filter('전체',this)\">전체</button>", read('engage-box.html') + "<div class=\"filters\"><button class=\"active\" onclick=\"filter('전체',this)\">전체</button>");
  rep("home:[...q('#select .filters'),$('grid'),$('info'),$('startBar')],", "home:[$('questBox'),...q('#select .filters'),$('grid'),$('info'),$('startBar')],");
  rep('  <div class="adminTile ownerOnly">\n    <b>🛡️ 관리자 임명 (제작자 전용)</b>', read('engage-tile.html') + '  <div class="adminTile ownerOnly">\n    <b>🛡️ 관리자 임명 (제작자 전용)</b>');
  rep("['server','🛠️ 서버',['서버 관리','서버 정보']]", "['server','🛠️ 서버',['서버 관리','서버 정보','통계']]");
  rep('/* ===================== 비밀번호 변경 ===================== */', read('engage.js').split('{{COIN}}').join(coinName || '코인') + '/* ===================== 비밀번호 변경 ===================== */');
  return s;
};
