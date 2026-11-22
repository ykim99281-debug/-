// PC·모바일 같이 하기 패치: 코드 속 위치·속도·범위 계산을 전투장(아레나) 기준으로 바꿔요.
// apply(s)는 해당 자리를 못 찾으면 오류로 멈춰요. (원본이 바뀌어 어긋난 것을 알려 주기 위해서예요)
const fs = require('fs');
const path = require('path');
exports.apply = function (s, marker) {
  const rep = (a, b, expect) => {
    const n = s.split(a).length - 1;
    if (n < 1 || (expect && n !== expect)) throw new Error('멀티스크린 패치 위치 확인 필요(' + n + '곳): ' + a.slice(0, 60));
    s = s.split(a).join(b);
  };
  // 1) 내 위치를 보낼 때 내 화면 크기(sw, sh)도 같이 보내요
  rep('x:player.x,y:player.y,char:player.name,action:p', 'x:player.x,y:player.y,sw:innerWidth,sh:innerHeight,char:player.name,action:p', 1);
  rep('x:player.x,y:player.y,char:player.name,emoji:pl', 'x:player.x,y:player.y,sw:innerWidth,sh:innerHeight,char:player.name,emoji:pl', 1);
  rep('x:player.x,y:player.y,char:player.name,hp:pvpMo', 'x:player.x,y:player.y,sw:innerWidth,sh:innerHeight,char:player.name,hp:pvpMo', 1);
  rep('x:player.x,y:player.y,char:player.name})}', 'x:player.x,y:player.y,sw:innerWidth,sh:innerHeight,char:player.name})}', 1);
  rep('x:player.x,y:player.y,hp:player.hp,max:player.m', 'x:player.x,y:player.y,sw:innerWidth,sh:innerHeight,hp:player.hp,max:player.m', 2);
  rep('x:player.x,y:player.y,started:true});', 'x:player.x,y:player.y,sw:innerWidth,sh:innerHeight,started:true});', 1);
  rep('x:innerWidth*.25,y:innerHeight*.62,hp:0,ts:Date.', 'x:myArena().x+myArena().w*.25,y:myArena().y+myArena().h*.62,sw:innerWidth,sh:innerHeight,hp:0,ts:Date.', 1);
  rep('x:innerWidth*.25,y:innerHeight*.62,hp:pvpMyHp,ma', 'x:myArena().x+myArena().w*.25,y:myArena().y+myArena().h*.62,sw:innerWidth,sh:innerHeight,hp:pvpMyHp,ma', 1);
  // 2) 받은 위치를 내 화면에 맞춰요 (같이 하는 친구 / 상대)
  rep('peerPlayers[id]=ps[id];', 'peerPlayers[id]=fixPeer(ps[id]);');
  rep('peerPlayers[m.id]=m;', 'peerPlayers[m.id]=fixPeer(m);');
  // 3) PvP: 전투장 안에서 움직이고, 이동 속도·근접 범위·탄환을 전투장 크기에 맞춰요
  rep('player={x:w*.25,y:h*.62,r:34,hp:pvpMyHp,', 'player={x:myArena().x+myArena().w*.25,y:myArena().y+myArena().h*.62,r:34,hp:pvpMyHp,', 1);
  rep('enemy={x:w*.72,y:h*.62,r:34,hp:op.hp||pvpMyHp,', 'enemy={x:myArena().x+myArena().w*.72,y:myArena().y+myArena().h*.62,r:34,hp:op.hp||pvpMyHp,', 1);
  rep('player.x+=vx/l*player.spd*90*dt;player.y+=vy/l*player.spd*90*dt;player.x=Math.max(34,Math.min(w-34,player.x));player.y=Math.max(h*.25,Math.min(h-54,player.y));let op=(pvpData.players||{})[pvpOpponentId];',
      '{const A=myArena();player.x+=vx/l*player.spd*90*dt*A.sc;player.y+=vy/l*player.spd*90*dt*A.sc;player.x=Math.max(A.x,Math.min(A.x+A.w,player.x));player.y=Math.max(A.y,Math.min(A.y+A.h,player.y));}let op=(pvpData.players||{})[pvpOpponentId];', 1);
  rep('enemy.x=op.x||enemy.x;enemy.y=op.y||enemy.y;', '{const q=netPos(op);enemy.x=q.x||enemy.x;enemy.y=q.y||enemy.y}', 1);
  rep('if(Math.hypot(b.x-enemy.x,b.y-enemy.y)<enemy.r+b.r){sendPvpDamage(b.dmg,b.color)', 'if(Math.hypot(b.x-enemy.x,b.y-enemy.y)<(enemy.r+b.r)*myArena().sc){sendPvpDamage(b.dmg,b.color)', 1);
  rep('dist=Math.hypot(player.x-enemy.x,player.y-enemy.y);if(dist<115){sendPvpDamage(d,color)', 'dist=Math.hypot(player.x-enemy.x,player.y-enemy.y);if(dist<115*myArena().sc){sendPvpDamage(d,color)', 1);
  { // 탄환 속도는 PvP 스킬에서만 전투장 크기에 맞춰요 (혼자 하기·협동은 그대로)
    const at = s.indexOf('_baseSkill(n);return}'), tgt = 'vx:dx/l*610,vy:dy/l*610,';
    const j = at < 0 ? -1 : s.indexOf(tgt, at);
    if (j < 0 || j - at > 900) throw new Error('멀티스크린 패치 위치 확인 필요: PvP 탄환');
    s = s.slice(0, j) + 'vx:dx/l*610*myArena().sc,vy:dy/l*610*myArena().sc,' + s.slice(j + tgt.length);
  }
  // 4) 같이 하기(협동)·PvP 보스/상대 그림: 받은 위치를 내 화면에 맞춰요
  rep('x:Math.floor(innerWidth*.72),y:Math.floor(innerHeight*.62),r:st%10===0?52', 'x:Math.floor(myArena().x+myArena().w*.72),y:Math.floor(myArena().y+myArena().h*.62),sw:innerWidth,sh:innerHeight,r:st%10===0?52', 1);
  rep('enemy={x:ed.x||w*.72,y:ed.y||h*.62,r:ed.r||40,', 'enemy={x:netPos(ed).x||w*.72,y:netPos(ed).y||h*.62,r:ed.r||40,', 1);
  // 5) 코드 붙이기 (비밀번호 변경 칸 앞)
  const m = marker || '/* ===================== 비밀번호 변경 ===================== */';
  const code = fs.readFileSync(path.join(__dirname, 'multiscreen.js'), 'utf8');
  if (s.split(m).length !== 2) throw new Error('멀티스크린 코드를 붙일 자리를 못 찾았어요');
  s = s.replace(m, () => code + m);
  return s;
};
