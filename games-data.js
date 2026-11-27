// 새 게임/업데이트는 이 파일만 고치면 games.html 메인에 자동 반영됩니다.
window.GAMES_DATA = {
  games: [
    { id: "neon-void", title: "NEON VOID", desc: "네온 슈팅 · 보스 4종 · 기체 3종 · 상점 · 오늘의 도전", url: "neon-void.html", icon: "🚀", color: "#37f0ff", version: "3.0", updated: "2026-11-26", tags: ["슈팅", "모바일"] },
    { id: "star-dodge", title: "별똥별 피하기", desc: "바위를 피하고 별을 모으는 가벼운 아케이드", url: "star-dodge.html", icon: "⭐", color: "#ffd23f", version: "1.0", updated: "2026-11-26", tags: ["아케이드"] }
  ],
  // 최신 순. 맨 위에 추가하세요.
  updates: [
    { date: "2026-11-26", game: "neon-void", version: "3.0", notes: ["배경음악(신스) 추가", "오늘의 도전 모드 + 일일 보너스", "보스 등장·격파 연출(슬로모션)"] },
    { date: "2026-11-26", game: "neon-void", version: "2.0", notes: ["상점·영구 강화 4종", "기체 3종(VANGUARD/STRIKER/TITAN)", "보스 4종 추가", "앱 설치(PWA)·전체화면·진동"] },
    { date: "2026-11-26", game: "neon-void", version: "1.0", notes: ["NEON VOID 출시"] },
    { date: "2026-11-26", game: "star-dodge", version: "1.0", notes: ["별똥별 피하기 출시"] }
  ],
  soon: ["업적/도감", "기체별 특수 스킬", "온라인 랭킹"]
};
