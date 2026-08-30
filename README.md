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

요구 사항은 Node.js 20 이상과 OpenRouter API 키입니다.

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
```

## `yejunlee.com/chatbot` 배포

현재 `yejunlee.com`의 GitHub Pages 홈페이지를 유지하기 위해 다음 구조를 사용합니다.

1. 이 저장소의 Next.js 앱을 Vercel에 배포합니다.
2. Vercel 프로젝트 환경변수에 아래 값을 등록합니다.

```dotenv
OPENROUTER_API_KEY=
SITE_URL=https://yejunlee.com/chatbot
SITE_NAME=Yejun's Private Chat
CHATBOT_USERNAME=yejun
CHATBOT_PASSWORD=
CHATBOT_SESSION_SECRET=
ENABLE_FILE_HISTORY_BACKUP=false
```

3. Vercel 배포 주소에서 `https://프로젝트.vercel.app/chatbot/login`이 열리는지 확인합니다.
4. `cloudflare-proxy/wrangler.jsonc`의 `ORIGIN_HOST`를 실제 Vercel 호스트명으로 바꿉니다. `https://`나 경로는 넣지 않습니다.
5. Cloudflare DNS에서 `yejunlee.com`을 가리키는 레코드가 **Proxied(주황색 구름)** 상태인지 확인합니다.
6. 프록시를 검증하고 배포합니다.

```bash
cd cloudflare-proxy
npm install
npm run cf-typegen
npm run typecheck
npm run check
npm run deploy
```

Worker 경로는 `yejunlee.com/chatbot*`으로 제한되어 있어 `/`와 기존 홈페이지 경로는 계속 GitHub Pages로 전달됩니다. Worker는 응답 본문을 버퍼링하지 않고 그대로 스트리밍하므로 채팅 응답 스트림도 유지됩니다.

## 데이터 저장

- 웹 배포에서는 대화와 설정을 현재 브라우저의 `localStorage`에만 저장합니다.
- 로컬 개발에서 `ENABLE_FILE_HISTORY_BACKUP=true`이면 `data/history.json`과 `data/history.md`에도 백업합니다.
- `data/`, `.env*`, Cloudflare 로컬 상태는 Git에서 제외됩니다.

## 주요 구조

- `src/app/(private)/`: 로그인 후에만 볼 수 있는 채팅·설정 화면
- `src/app/login/`: 개인 로그인 화면
- `src/app/api/auth/`: 로그인·로그아웃 API
- `src/app/api/chat/`: 인증된 OpenRouter 스트리밍 프록시
- `src/app/api/history/`: 인증된 대화 기록 동기화
- `src/lib/session.ts`: 자격 확인과 서명 세션 처리
- `cloudflare-proxy/`: `/chatbot`만 Vercel로 전달하는 Cloudflare Worker
