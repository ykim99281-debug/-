/* ===================== 이야기 다시 보기 (프롤로그 + 열린 장을 이어서) ===================== */
function storyReplay(startName){
  if(typeof STORY==='undefined')return;
  const old=$('replayOv');if(old)old.remove();
  const lv=(typeof worldLevel==='function')?worldLevel():1,pages=[];
  (STORY.prologue||[]).forEach(t=>pages.push({tag:STORY.title,head:'프롤로그',text:t}));
  worldPlaces.forEach(p=>{const c=STORY.chapters[p.name];if(c&&lv>=p.level)pages.push({tag:p.name,head:c.title,text:c.text,boss:c.boss,place:p.name})});
  if(!pages.length)return;
  let i=Math.max(0,pages.findIndex(x=>x.place===startName));
  const ov=storyOverlay('<div id="rpTag" style="font-size:13px;letter-spacing:3px;color:#c4b5fd"></div><h2 id="rpHead" style="margin:8px 0 12px;color:#fff;text-shadow:0 2px 12px #000"></h2><div id="rpText" style="font-size:17px;line-height:1.9;min-height:140px;white-space:pre-line;color:#f5f3ff;text-shadow:0 2px 10px #000;word-break:keep-all"></div><div id="rpBoss" style="margin-top:10px;font-size:14px;color:#fca5a5;font-style:italic"></div><div id="rpNo" style="margin:10px 0;color:#a78bfa"></div><div style="display:flex;gap:8px;justify-content:center;margin-bottom:8px"><button id="rpPrev" class="blue">◀ 이전</button><button id="rpNext" class="purple">다음 ▶</button><button id="rpClose" class="red">닫기</button></div>');
  ov.id='replayOv';
  const draw=()=>{const g=pages[i];
    ov.querySelector('#rpTag').textContent=g.tag;ov.querySelector('#rpHead').textContent=g.head;ov.querySelector('#rpText').textContent=g.text;
    ov.querySelector('#rpBoss').textContent=g.boss?'👹 「'+g.boss+'」':'';
    ov.querySelector('#rpNo').textContent=(i+1)+' / '+pages.length;
    ov.querySelector('#rpPrev').style.visibility=i>0?'visible':'hidden';
    ov.querySelector('#rpNext').textContent=i<pages.length-1?'다음 ▶':'끝내기';};
  ov.querySelector('#rpPrev').onclick=()=>{if(i>0){i--;draw()}};
  ov.querySelector('#rpNext').onclick=()=>{if(i<pages.length-1){i++;draw()}else ov.remove()};
  ov.querySelector('#rpClose').onclick=()=>ov.remove();
  draw();
}
