/* ===================== PC·모바일 같이 하기: 화면 크기와 상관없는 공정한 전투장 ===================== */
// 전투장(아레나): 화면 안에 16:9 상자를 가운데에 놓고, 위치를 이 상자 기준으로 주고받아요.
// 그래서 PC(큰 화면)와 모바일(작은 화면)에서 서로 같은 자리에 보이고, 이동 속도·공격 범위도 상자 크기에 맞춰 똑같이 계산돼요.
function arenaOf(sw,sh){
  const rw=Math.max(120,sw-68),rh=Math.max(120,sh*.75-54),aw=Math.max(100,Math.min(rw,rh*16/9)),ah=aw*9/16;
  return {x:34+(rw-aw)/2,y:sh*.25+(rh-ah)/2,w:aw,h:ah,sc:aw/1000};
}
function myArena(){return arenaOf(innerWidth,innerHeight)}
function netPos(o){ // 다른 화면에서 온 위치 → 내 화면 위치
  if(!o||typeof o.x!=='number'||typeof o.y!=='number')return {x:o&&o.x,y:o&&o.y};
  if(!o.sw||!o.sh)return {x:o.x,y:o.y};
  const a=arenaOf(o.sw,o.sh),m=myArena();
  return {x:m.x+(o.x-a.x)/a.w*m.w,y:m.y+(o.y-a.y)/a.h*m.h};
}
function fixPeer(o){ // 받은 위치를 내 화면에 맞춰 바꾸고, 다시 바꾸지 않도록 표시해요
  if(!o)return o;
  const q=netPos(o);
  if(typeof q.x==='number'&&typeof q.y==='number'){o.x=q.x;o.y=q.y;o.sw=innerWidth;o.sh=innerHeight}
  return o;
}
{const _drawArena=draw;draw=function(){_drawArena();
  if(typeof pvpMode!=='undefined'&&pvpMode&&ctx){const A=myArena();ctx.save();ctx.strokeStyle='rgba(255,255,255,.2)';ctx.setLineDash([10,8]);ctx.lineWidth=2;ctx.strokeRect(A.x,A.y,A.w,A.h);ctx.restore()}
}}
