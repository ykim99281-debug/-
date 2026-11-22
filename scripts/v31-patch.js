// 3.1 업데이트 패치: 쪽지(DM), 쿠폰, 스테이지 순위, 주간 도전, 설정을 끼워 넣어요.
// apply(s, {coin, dm, rank}): 어린이 판은 dm·rank 를 꺼요. 자리를 못 찾으면 오류로 멈춰요.
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
exports.apply = function (s, o) {
  o = o || {};
  const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('3.1 패치 위치 확인 필요: ' + a.slice(0, 60)); s = s.replace(a, () => b); };
  const filters = "<div class=\"filters\"><button class=\"active\" onclick=\"filter('전체',this)\">전체</button>";
  let boxes = read('v31-weekly-box.html') + read('v31-coupon-box.html');
  if (o.dm) boxes += read('v31-dm-box.html');
  if (o.rank) boxes += read('v31-rank-box.html');
  rep(filters, boxes + filters);
  rep('<div class="box" id="diagBox" data-guest="1">', read('v31-settings-box.html') + '<div class="box" id="diagBox" data-guest="1">');
  rep("home:[$('growBox'),$('questBox'),", "home:[$('growBox'),$('questBox'),$('weeklyBox'),$('couponBox'),");
  if (o.dm) rep("online:[...q('#select .room'),", "online:[$('dmBox'),...q('#select .room'),");
  if (o.rank) rep("battle:[...q('#select .tradeRoom'),", "battle:[$('stageRankBox'),...q('#select .tradeRoom'),");
  rep("$('feedBox'),", "$('feedBox'),$('setBox'),");
  rep('  <div class="adminTile ownerOnly">\n    <b>🛡️ 관리자 임명 (제작자 전용)</b>', read('v31-coupon-tile.html') + '  <div class="adminTile ownerOnly">\n    <b>🛡️ 관리자 임명 (제작자 전용)</b>');
  rep("['give','🎁 지급',['내 보상','특정 유저 지급','전체 유저 보상','프리미엄']]", "['give','🎁 지급',['내 보상','특정 유저 지급','전체 유저 보상','프리미엄','쿠폰']]");
  let js = read('v31-weekly.js') + read('v31-coupon.js') + (o.dm ? read('v31-dm.js') : '') + (o.rank ? read('v31-rank.js') : '');
  rep('/* ===================== 비밀번호 변경 ===================== */', js.split('CUR2').join('CUR2') + '/* ===================== 비밀번호 변경 ===================== */');
  return s;
};
