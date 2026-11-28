/* ============================================================
   게임 목록 — 새 게임을 추가하려면 GAMES 맨 위에 항목 하나만 넣으면 됩니다.
   업데이트 내역은 UPDATES 맨 위에 한 줄 추가하세요.
   ============================================================ */
window.GAMES = [
  {
    id: 'merge-pop',
    title: 'MERGE POP',
    emoji: '🍉',
    desc: '같은 과일을 합쳐 수박까지! 요즘 유행하는 합치기 퍼즐. 드래그로 위치 조절, 손을 떼면 투하.',
    tags: ['퍼즐', '합치기', '모바일'],
    url: 'merge-pop.html',
    added: '2026-11-28',
    bestKey: 'mp_best', unit: '점',
  },
  {
    id: 'hook-swing',
    title: 'HOOK SWING',
    emoji: '🕸️',
    desc: '로프를 걸고 휘두르며 날아가라! 쫓아오는 어둠과 용암을 피해 최대한 멀리.',
    tags: ['아케이드', '1버튼', '모바일'],
    url: 'hook-swing.html',
    thumb: 'arcade-thumbs/hook-swing.jpg',
    added: '2026-11-26',
    bestKey: 'hookSwingBest', unit: '점',
  },
  {
    id: 'neon-survivor',
    title: 'NEON SURVIVOR',
    emoji: '👾',
    desc: '끝없는 네온 군단 속에서 살아남기. 대시, 콤보, 10+종 업그레이드, 보스전.',
    tags: ['서바이버', '액션', '모바일'],
    url: 'neon-survivor.html',
    thumb: 'arcade-thumbs/neon-survivor.jpg',
    added: '2026-11-26',
    bestKey: 'neonSurvivorBest', unit: 'time',
  },
];

window.UPDATES = [
  { date: '2026-11-28', text: '신작 MERGE POP 출시 — 과일 합치기 퍼즐' },
  { date: '2026-11-26', text: '게임 허브 오픈! HOOK SWING, NEON SURVIVOR 수록' },
  { date: '2026-11-26', text: 'NEON SURVIVOR: 대시 · 콤보 · 연쇄 번개 · 유도 미사일 · 습격 이벤트 추가' },
];
