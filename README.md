# ChatbotAI

OpenRouter API를 사용하는 로컬 웹 채팅 애플리케이션입니다. Next.js App Router와 TypeScript로 구성되어 있으며, 모델 선택·스트리밍 응답·이미지 입력·대화 기록 백업을 지원합니다.

## 주요 기능

- SSE 기반 스트리밍 채팅과 응답 중단·재생성
- 유료·무료 모델 선택 및 자동 라우팅
- 마크다운, 코드 하이라이팅, 이미지 입력과 이미지 응답 표시
- 라이트·다크 테마
- 모델 목록, 시스템 프롬프트, temperature 설정
- 브라우저 localStorage와 로컬 `data/` 폴더에 대화 기록 저장

## 요구 사항

- Node.js 20 이상
- OpenRouter API 키

## 실행

Windows에서는 `start.bat`을 실행하면 의존성을 설치하고 개발 서버를 시작합니다.

직접 실행하려면 프로젝트 루트에 `.env.local`을 만들고 다음 값을 설정합니다.

```dotenv
OPENROUTER_API_KEY=your_key_here
SITE_URL=http://localhost:3000
SITE_NAME=Local Chat
```

그다음 아래 명령을 실행합니다.

```bash
npm install
npm run dev
```

기본 주소는 `http://localhost:3000`입니다.

## 검증 및 프로덕션 실행

```bash
npm run lint
npm run build
npm start
```

## 데이터와 비밀정보

- `.env`, `.env.local`을 포함한 모든 `.env*` 파일은 Git에서 제외됩니다.
- `data/`에는 개인 대화 기록이 저장되므로 Git에서 제외됩니다.
- API 키는 서버에서만 읽으며 브라우저 코드에 포함하지 않습니다.

## 구조

- `src/app/api/chat/`: OpenRouter 스트리밍 API 프록시
- `src/app/api/history/`: 로컬 대화 기록 동기화
- `src/components/`: 채팅·설정 UI
- `src/lib/`: 모델 목록, 상태 저장소, 자동 라우팅
- `start.bat`: Windows 실행 도우미
