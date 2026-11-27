# 버스 운전교실 타이쿤

광주를 달리는 3D 버스 운전·경영 시뮬레이션 (Three.js r128, 빌드 도구 없음).

## 구조
- `index.html` — 진입점(HTML/CSS, 스크립트 로드 순서 정의)
- `js/version.js` 버전 · `core` 지도/경로 · `world` 도시/날씨 · `vehicles` 차량/AI · `game` 경영/저장/오프라인 · `player` 운전/택시 · `ui` 화면 · `updater` 업데이트/PWA · `main` 메인 루프/입력
- `vendor/three.min.js` 로컬 라이브러리(CDN은 대비책)
- `version.json` 최신 버전 + 변경 내역(게임이 주기적으로 확인) · `CHANGELOG.md`
- `manifest.webmanifest`, `sw.js`, `icons/` — 설치·오프라인
- `tools/release.js` 릴리스 도구 · `tests/` 자동 점검

## 업데이트하는 법
1. 코드를 수정한다.
2. `node tools/release.js patch "변경 1; 변경 2"` (`minor`/`major` 가능)
   → 버전, `?v=` 캐시 번호, 서비스 워커 캐시 이름, 변경 내역이 한 번에 갱신된다.
3. 테스트(`tests/README.md`) 후 배포하면, 이미 켜 둔 플레이어는 10분 안에(또는 다시 열 때) “새 버전” 알림을 받고 저장 후 업데이트한다.

저장 데이터(localStorage)는 업데이트해도 유지되며 `sanitizeSave`가 옛 저장을 변환한다.
