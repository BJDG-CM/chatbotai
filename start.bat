@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ============================================
echo   Local Chat - OpenRouter AI 채팅 플랫폼
echo ============================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js/npm이 설치되어 있지 않습니다.
  echo https://nodejs.org 에서 설치한 뒤 다시 실행해주세요.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/3] 처음 실행이라 패키지를 설치합니다. 잠시만 기다려주세요...
  call npm install
  if errorlevel 1 (
    echo [오류] 패키지 설치 중 문제가 발생했습니다.
    pause
    exit /b 1
  )
)

if not exist .env.local (
  echo [2/3] .env.local 파일을 생성합니다.
  (
    echo OPENROUTER_API_KEY=
    echo SITE_URL=http://localhost:3000
    echo SITE_NAME=Local Chat
  ) > .env.local
  echo        .env.local 파일을 열어 OPENROUTER_API_KEY를 입력해주세요.
)

findstr /R /C:"^OPENROUTER_API_KEY=$" .env.local >nul 2>nul
if not errorlevel 1 (
  echo.
  echo [알림] .env.local 의 OPENROUTER_API_KEY가 비어 있습니다.
  echo        https://openrouter.ai/keys 에서 키를 발급받아 입력해주세요.
  echo.
)

echo [3/3] 개발 서버를 시작합니다. 잠시 후 브라우저가 자동으로 열립니다.
echo        종료하려면 이 창을 닫으세요.
echo.

start "" cmd /c "timeout /t 4 >nul && start http://localhost:3000"
call npm run dev

pause
