// rpg.html 의 게임 데이터(캐릭터·장비)를 서버 함수가 쓰는 JSON 으로 내보냅니다.
// 게임 데이터를 바꾼 뒤에는 반드시 다시 실행하세요:  node scripts/export-gamedata.js
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','rpg.html'),'utf8');
function grab(name){
  const m=html.match(new RegExp('const '+name+'=\\[([\\s\\S]*?)\\n?\\];'));
  if(!m)throw new Error(name+' 를 찾지 못했어요');
  return new Function('return ['+m[1]+']')();
}
const chars=grab('chars').map(c=>({name:c.name,rare:!!c.rare,price:c.price}));
const equips=grab('equips').map(e=>({name:e.name,price:e.price}));
const katanas=grab('katanas').map(k=>k.name);
const out={chars,equips,katanas};
fs.writeFileSync(path.join(__dirname,'..','functions','gamedata.json'),JSON.stringify(out,null,1));
console.log('내보냄:',chars.length,'캐릭터,',equips.length,'장비,',katanas.length,'호흡 장비');
