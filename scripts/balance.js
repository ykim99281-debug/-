/* ===================== 밸런스 패치: 공격 연타 제한, 회피 재사용 대기 ===================== */
const BAL_ATK_CD=.18,BAL_DASH_CD=1.6;          // 공격은 초당 5~6번까지, 회피는 1.6초에 한 번
let atkCd=0,dashCd=0;
{const _u=upd;upd=function(dt){atkCd=Math.max(0,atkCd-dt);dashCd=Math.max(0,dashCd-dt);return _u.apply(this,arguments)}}
{const _a=attack;attack=function(){if(atkCd>0)return;atkCd=BAL_ATK_CD;return _a.apply(this,arguments)}}
{const _d=dash;dash=function(){if(dashCd>0){try{msg('회피는 잠시 뒤에 다시 쓸 수 있어요')}catch(e){}return}dashCd=BAL_DASH_CD;return _d.apply(this,arguments)}}
