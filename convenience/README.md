# 편의점 사장 키우기 (독립 프로젝트)

기존 게임들과 분리된 별도 메인입니다. 이 폴더(`convenience/`)만 따로 배포하면 됩니다. 시작 화면은 `index.html`.

## 구조
- `index.html` — 빌드 결과(단일 파일, three.js 포함, 더블클릭으로도 실행)
- `manifest.webmanifest`, `sw.js`, `cvs-icon-*.png` — PWA(설치/오프라인)
- `src/` — 소스 (`game.js` 로직·UI, `scene.js` 3D 월드, `template.html`)

## 업데이트 방법
```
cd convenience/src && npm i && npm run build   # → ../index.html 재생성
```
소스를 고치고 빌드한 뒤 커밋·푸시하면 됩니다. 세이브는 브라우저 localStorage(`cvs_boss_v1`)에 저장됩니다.

## 따로 배포 (예: Cloudflare Pages / Firebase Hosting)
빌드 출력 디렉터리를 `convenience`로 지정하세요. 서비스워커 `sw.js`는 `Cache-Control: no-cache` 권장.
