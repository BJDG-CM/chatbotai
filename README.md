# Yejun's Private Chat

OpenRouter API를 사용하는 개인용 Next.js 채팅 앱입니다. `chatbot.yejunlee.com`에서 실행되며, 서버 환경변수로 지정한 한 명만 로그인할 수 있습니다.

## 보안 구조

- 사용자명과 비밀번호는 서버 환경변수에서만 읽으며 브라우저 번들·Git 저장소에 포함되지 않습니다.
- 로그인에 성공하면 7일 동안 유효한 `HttpOnly`, `SameSite=Strict` 서명 쿠키를 발급합니다.
- 채팅 화면과 설정 화면뿐 아니라 `/api/chat`, `/api/history`도 서버에서 각각 인증을 검사합니다.
- 세션 쿠키는 `chatbot.yejunlee.com` 호스트에서만 전송됩니다.
- 전체 앱에 `noindex`, `nofollow`, `noarchive` 헤더와 메타데이터를 적용합니다.
- OpenRouter API 키는 서버에만 존재합니다.
- 로그인은 IP당 15분에 5회 실패하면 15분 동안, 전체로 60분에 20회 실패하면 60분 동안 막습니다(`LoginGuard` Durable Object). 가드를 쓸 수 없으면 로그인하지 않고 503을 반환하며, 이미 발급된 세션 쿠키에는 영향이 없습니다. 전체 정지는 풀린 뒤 제3자가 실패 요청 20회로 다시 걸 수 있으므로 반복 공격이 계속되면 새 로그인이 계속 막힐 수 있습니다(기존 세션은 만료 전까지 그대로 유효).
- `/api/chat`은 본문 24 MiB, 메시지 200개, 내가 올리는 이미지는 메시지당 3장(장당 4 MiB)까지만 받고, 허용된 모델만 호출합니다. `max_tokens`는 기본 4096, 최대 `CHAT_MAX_OUTPUT_TOKENS`(기본 16384)입니다. 목록에 없는 모델은 쉼표로 구분한 `CHAT_EXTRA_MODEL_IDS`에 넣어야 쓸 수 있습니다. 두 값은 `wrangler.jsonc`의 `vars`에서 수정하며(배포 때 반영), 로컬에서는 `.env.local`로 덮어쓸 수 있습니다.
- 상태를 바꾸는 API(POST)는 같은 출처(`Origin`)의 요청만 받고, 로그아웃을 뺀 나머지는 `Content-Type: application/json`만 받습니다.

## 로컬 실행

요구 사항은 Node.js 22 이상과 OpenRouter API 키입니다.

```bash
cp .env.example .env.local
npm install
npm run dev
```

`.env.local`에서 다음 값을 반드시 변경합니다.

```dotenv
OPENROUTER_API_KEY=
SITE_URL=http://localhost:3000
SITE_NAME=Yejun's Private Chat
CHATBOT_USERNAME=yejun
CHATBOT_PASSWORD=
CHATBOT_SESSION_SECRET=
ENABLE_FILE_HISTORY_BACKUP=true
```

세션 비밀값은 아래처럼 생성할 수 있습니다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`npm run dev`는 `vinext dev`로 앱을 실행합니다. 운영과 같은 Workers 런타임이라 로컬에서도 로그인 보호용 Durable Object(`LoginGuard`)가 동작합니다. 로컬 주소는 `http://localhost:3000`입니다.

로컬에서는 `cf-connecting-ip`가 없어 모든 요청이 하나의 IP로 계산되고, Durable Object 상태는 `.wrangler/state`에 남습니다. 로컬에서 로그인이 잠겼다면 `.wrangler/state`를 지우고 서버를 다시 시작하세요. `data/` 파일 백업은 Node 런타임에서만 동작하며 `vinext dev`에서는 동작하지 않습니다.

## 검증

`npm run build`는 `vinext build`입니다.

```bash
npm test
npm run lint
npm run build
npm run cloudflare:build
```

## `chatbot.yejunlee.com` 배포

앱 전체를 Cloudflare Workers에서 직접 실행합니다. 별도 원본 서버는 사용하지 않습니다. `chatbot.yejunlee.com`은 Worker의 Custom Domain이며, 기존 `yejunlee.com` 홈페이지와 DNS 레코드는 변경하지 않습니다.

1. Cloudflare에 로그인합니다.

```bash
npx wrangler login
```

2. 로그인 사용자명, 비밀번호, OpenRouter 키와 세션 비밀값을 Cloudflare 암호화 Secret으로 등록합니다. 각 명령은 값을 터미널에서 직접 입력받으며 Git 저장소에 기록하지 않습니다.

```bash
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put CHATBOT_USERNAME
npx wrangler secret put CHATBOT_PASSWORD
npx wrangler secret put CHATBOT_SESSION_SECRET
```

`CHATBOT_SESSION_SECRET`은 32바이트 이상이어야 합니다. 생성 예시는 다음과 같습니다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

3. Cloudflare Workers용 빌드를 검증하고 배포합니다.

```bash
npm ci
npm run cloudflare:typegen
npm run cloudflare:build
npm run cloudflare:deploy
```

4. 배포가 완료되면 Cloudflare가 `chatbot.yejunlee.com` DNS 레코드와 TLS 인증서를 자동으로 생성합니다. 해당 호스트에 기존 CNAME이 있으면 먼저 삭제해야 합니다.

5. `https://chatbot.yejunlee.com/login`에서 지정한 계정으로 로그인되는지 확인합니다.

## 데이터 저장

- Cloudflare 배포에서는 대화와 설정을 현재 브라우저의 `localStorage`에만 저장합니다.
- 로컬 개발에서 `ENABLE_FILE_HISTORY_BACKUP=true`이면 `data/history.json`과 `data/history.md`에도 백업합니다.
- `data/`, `.env*`, Cloudflare 로컬 상태는 Git에서 제외됩니다.

## 주요 구조

- `src/app/(private)/`: 로그인 후에만 볼 수 있는 채팅·설정 화면
- `src/app/login/`: 개인 로그인 화면
- `src/app/api/auth/`: 로그인·로그아웃 API
- `src/app/api/chat/`: 인증된 OpenRouter 스트리밍 프록시
- `src/app/api/history/`: 인증된 대화 기록 동기화
- `src/lib/session.ts`: 자격 확인과 서명 세션 처리
- `worker/`: 커스텀 Worker 엔트리(`index.ts`)와 로그인 시도를 세는 `LoginGuard` Durable Object(SQLite)
- `vite.config.ts`: Next.js 앱을 Workers용으로 변환하는 vinext 설정
- `wrangler.jsonc`: `chatbot.yejunlee.com` Custom Domain, Secret 요구 사항, `LoginGuard` Durable Object 바인딩과 migration, Workers 런타임 설정
