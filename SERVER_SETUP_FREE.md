# 카드 없이 서버 모드 켜는 방법 (Cloudflare Workers, 무료)

**돈이 들지 않아요.** 카드를 등록하지 않으니 청구될 일도 없어요.
(Firebase Functions 방식은 `SERVER_SETUP.md` 에 있지만 Blaze 요금제와 카드가 필요해요.)

## 준비물
- 이메일 주소 (Cloudflare 가입용)
- 내 컴퓨터 (Windows/Mac/Linux) + Node.js 20 이상
- Firebase 콘솔에 로그인할 수 있는 구글 계정

## 1. Cloudflare 무료 계정 만들기
https://dash.cloudflare.com/sign-up 에서 이메일과 비밀번호로 가입하세요. **카드는 묻지 않아요.**

## 2. Firebase 서비스 계정 키 받기 (비밀 키!)
1. Firebase 콘솔 → 왼쪽 위 ⚙ → **프로젝트 설정** → **서비스 계정** 탭
2. **새 비공개 키 생성** → JSON 파일이 다운로드돼요.
3. ⚠ 이 파일은 **비밀번호보다 중요해요.** 이 파일이 있으면 데이터베이스 전체를 마음대로 바꿀 수 있어요.
   - 채팅·메일·GitHub 에 **절대 올리지 마세요.** (저장소는 공개예요)
   - 쓰고 나면 안전한 곳에 한 개만 보관하세요.

## 3. 서버 올리기
이 저장소를 내려받은 폴더에서:
```bash
cd worker
npm install
npx wrangler login          # 브라우저가 열리면 Cloudflare 계정으로 허용
```

**비밀 키 넣기** (파일 경로는 다운로드한 JSON 파일로 바꾸세요)
- Mac/Linux:
  ```bash
  cat ~/Downloads/내키파일.json | npx wrangler secret put SA_JSON
  ```
- Windows PowerShell:
  ```powershell
  Get-Content "$HOME\Downloads\내키파일.json" -Raw | npx wrangler secret put SA_JSON
  ```

**배포**
```bash
npx wrangler deploy
```
끝나면 `https://seongjwa-server.내계정.workers.dev` 같은 **주소**가 나와요. 그 주소 뒤에 `/health` 를 붙여서 브라우저로 열었을 때 `{"ok":true}` 가 보이면 성공이에요.

## 4. 규칙 게시
`firebase-rules-anime.json` 내용을 Realtime Database → 규칙 탭에 붙여 넣고 게시하세요.

## 5. 게임에서 켜기
1. 제작자 계정으로 로그인 → **🛡️ 관리자 패널 → 🛠️ 서버**
2. **서버 주소** 칸에 3번에서 받은 주소를 넣고 **서버 주소 저장** (연결이 되는지 먼저 확인해요)
3. **🔒 서버 모드 켜기** (서버에 로그인 확인까지 해 보고 켜요)
4. 일반 계정으로 구매·환전·뽑기·전투·거래가 되는지 확인하세요.
5. 문제가 있으면 **서버 모드 끄기**로 바로 되돌릴 수 있어요.

## 무료 한도
- Cloudflare Workers 무료: **하루 10만 요청**. 넘으면 그날은 서버 요청이 거절되고(**요금은 청구되지 않아요**), 이때는 **서버 모드 끄기**로 돌려 두면 돼요.
- 게임에서 한 번 구매·환전·전투 보상·거래를 할 때마다 1~2 요청이 쓰여요.
- 플레이어가 많아져 한도가 모자라면 그때 유료로 올리거나 Firebase Functions 방식으로 옮기세요. 이미 둘 다 지원해요.

## 키가 새어 나갔다면
Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 해당 키를 **삭제**하고, 새 키를 만들어 2~3번을 다시 하세요.

## 게임 데이터를 바꾼 뒤에는
캐릭터 이름·가격, 장비 가격을 바꿨다면:
```bash
node scripts/export-gamedata.js
cd worker && npx wrangler deploy
```

## 안전 메모
- Worker 는 **게임이 열리는 주소(`ALLOWED_ORIGINS`)에서 온 요청만** 받아요. 주소가 바뀌면 `worker/wrangler.toml` 을 고치고 다시 배포하세요.
- 로그인 토큰을 Google 공개 키로 직접 검증하고, 닉네임·밴·점검·구버전 확인은 서버에서 해요.
- 정상 속도로 자동 사냥 프로그램을 돌리는 건 막지 못해요. 하루 보상 한도와 장부(`anime/ledger`)로 제한하세요.
