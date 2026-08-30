# Yejun's Private Chat

OpenRouter API를 사용하는 개인용 Next.js 채팅 앱입니다. 모든 앱 경로는 `/chatbot` 아래에 있으며, 서버 환경변수로 지정한 한 명만 로그인할 수 있습니다.

## 보안 구조

- 사용자명과 비밀번호는 서버 환경변수에서만 읽으며 브라우저 번들·Git 저장소에 포함되지 않습니다.
- 로그인에 성공하면 7일 동안 유효한 `HttpOnly`, `SameSite=Strict` 서명 쿠키를 발급합니다.
- 채팅 화면과 설정 화면뿐 아니라 `/api/chat`, `/api/history`도 서버에서 각각 인증을 검사합니다.
- 세션 쿠키는 `/chatbot` 경로에서만 전송됩니다.
- 전체 앱에 `noindex`, `nofollow`, `noarchive` 헤더와 메타데이터를 적용합니다.
- OpenRouter API 키는 서버에만 존재합니다.

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
SITE_URL=http://localhost:3000/chatbot
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

로컬 주소는 `http://localhost:3000/chatbot`입니다.

## 검증

```bash
npm run lint
npm run build
npm run cloudflare:build
```

## `yejunlee.com/chatbot` 배포

앱 전체를 Cloudflare Workers에서 직접 실행합니다. 별도 원본 서버는 사용하지 않습니다. Worker 경로는 `yejunlee.com/chatbot*`으로만 제한되므로 `/`와 나머지 기존 GitHub Pages 홈페이지 경로는 그대로 유지됩니다.

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

3. Cloudflare DNS에서 `yejunlee.com`을 가리키는 레코드가 **Proxied(주황색 구름)** 상태인지 확인합니다. Worker Route가 적용되기 위한 필수 조건입니다.

4. Cloudflare Workers용 빌드를 검증하고 배포합니다.

```bash
npm ci
npm run cloudflare:typegen
npm run cloudflare:build
npm run cloudflare:deploy
```

5. `https://yejunlee.com/chatbot/login`에서 지정한 계정으로 로그인되는지 확인합니다. `/`는 기존 GitHub Pages 홈페이지가 계속 열려야 합니다.

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
- `vite.config.ts`: Next.js 앱을 Workers용으로 변환하는 vinext 설정
- `wrangler.jsonc`: `/chatbot*` Route, Secret 요구 사항, Workers 런타임 설정
