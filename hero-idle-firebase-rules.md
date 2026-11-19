# 용사 키우기(hero-idle) Firebase 규칙

`hero-idle.html`은 뇌절RPG와 **같은 Firebase 프로젝트·같은 계정**을 쓰고, 이 게임 데이터만 아래 5개 노드에 따로 저장해요.

| 노드 | 내용 | 읽기 | 쓰기 |
|---|---|---|---|
| `heroIdle/<uid>` | 유저 저장 데이터 | 본인, 관리자 | 본인(정지·점검 아닐 때), 관리자 |
| `heroIdlePub/<uid>` | 관리자 패널용 요약 | 관리자 | 본인(정지·점검 아닐 때), 관리자 |
| `heroIdleBans/<uid>` | 이 게임 정지·삭제 기록 | 본인, 관리자 | 관리자 (뇌절RPG 밴 규칙과 같음) |
| `heroIdleEvent` | 진행 중인 이벤트 | 로그인한 모두 | 관리자 |
| `heroIdleConfig` | 점검·최소 버전 | 로그인한 모두 | 관리자 |

관리자 확인은 뇌절RPG와 같은 `brainRpgAdmins/<uid>`예요. 최고관리자는 로그인하면 자기 자신을 `brainRpgAdmins`에 `"super"`로 등록해요.

## 파일
- `firebase-database-rules-merged.json` — **원래 규칙을 한 글자도 바꾸지 않고** 위 5개 노드만 끼워 넣은 **전체 규칙**. 이걸 콘솔에 통째로 붙여넣으면 돼요.
- `hero-idle-firebase-rules.json` — 새로 추가된 5개 노드만 따로 모아 둔 것.

## 적용 방법
1. Firebase 콘솔 → Realtime Database → **규칙**. (혹시 몰라 지금 규칙을 먼저 복사해 백업)
2. `firebase-database-rules-merged.json` 내용을 붙여넣고 **게시**.
3. 게임 안 `🛠️ 관리자 패널 → ⚙️ 서버 → 서버 진단`으로 읽기·쓰기 확인 (❌ 줄이 막힌 곳).
