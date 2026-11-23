// 밸런스 패치: 보스 난이도 급등 완화, 적 속도 제한, 공격 연타·회피 연타 제한, 경험치 곡선.
// 시뮬레이션(자동 플레이)으로 측정한 숫자예요. apply(s)는 자리를 못 찾으면 오류로 멈춰요.
const fs = require('fs');
const path = require('path');
exports.apply = function (s) {
  const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('밸런스 패치 위치 확인 필요: ' + a.slice(0, 60)); s = s.replace(a, () => b); };
  // 일반 전투: 보스는 체력 ×1.3 / ×1.6, 공격 ×1.15 / ×1.3 (예전: 둘 다 ×1.55 / ×2.1), 일반 몬스터 공격 기울기 9 → 7, 속도는 4.8까지만
  rep('let mult=stage%10===0?2.1:stage%5===0?1.55:1;', 'let mult=stage%10===0?1.6:stage%5===0?1.3:1,amult=stage%10===0?1.3:stage%5===0?1.15:1;');
  rep('atk:(26+stage*9)*mult', 'atk:(26+stage*7)*amult');
  rep('1.45+stage*.16', 'Math.min(4.8,1.45+stage*.16)');
  // 던전 보스
  rep('(boss?2.2:1.35)', '(boss?1.8:1.35)');
  rep('(boss?1.65:1.2)', '(boss?1.4:1.2)');
  // 협동 보스 (여럿이 함께 깎는 체력)
  rep('mult=st%10===0?2.35:st%5===0?1.75:1.18', 'mult=st%10===0?2.0:st%5===0?1.55:1.18');
  const code = fs.readFileSync(path.join(__dirname, 'balance.js'), 'utf8');
  rep('/* ===================== 비밀번호 변경 ===================== */', code + '/* ===================== 비밀번호 변경 ===================== */');
  return s;
};
