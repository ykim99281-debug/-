// 대규모 업데이트 패치: 홈 탭에 "내 성장", 레벨·출석·업적·몬스터 패턴 코드를 끼워 넣어요.
// apply(s, coinName)는 자리를 못 찾으면 오류로 멈춰요. (재미 패치가 먼저 적용된 뒤에 써요)
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
exports.apply = function (s, coinName) {
  const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('성장 패치 위치 확인 필요: ' + a.slice(0, 60)); s = s.replace(a, () => b); };
  rep('<div class="box" id="questBox">', read('grow-box.html') + '<div class="box" id="questBox">');
  rep("home:[$('questBox'),", "home:[$('growBox'),$('questBox'),");
  rep('/* ===================== 비밀번호 변경 ===================== */', read('grow.js').split('{{COIN}}').join(coinName || '코인') + '/* ===================== 비밀번호 변경 ===================== */');
  return s;
};
