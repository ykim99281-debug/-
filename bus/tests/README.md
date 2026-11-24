# 버스 게임 자동 점검

Playwright(헤드리스 Chromium)로 게임을 실제로 구동해 확인하는 스크립트입니다.
three.js(r128) 파일을 로컬에 두고 경로를 알려 주세요 (CDN이 막힌 환경용).

```bash
npm pack three@0.128.0 && tar xzf three-0.128.0.tgz   # package/build/three.min.js
export THREE_JS=$PWD/package/build/three.min.js
node smoke.js          # 모든 화면·진입점을 클릭으로 훑기 (수정 후 가장 먼저 실행)
node fuzz-player.js    # 버스·교습·승용차 13종·택시를 무작위 입력으로 흔들기
node wall-tunnel.js    # 최고속·저프레임에서 벽/구조물 통과 여부
node save-compat.js    # 옛 저장·손상된 저장 이전/복구
node leak.js           # 버스 매매·자유주행·교습 반복 시 GPU 메모리 누수
node company-edge.js   # 운전 중 노선 삭제/매각, 마이너스 자금, 대출 한도 등
node sim-longrun.js    # 100분 시뮬레이션: NaN, 교착, 정체
```
