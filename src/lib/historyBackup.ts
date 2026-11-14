/**
 * data/ 폴더로 대화 기록 파일 백업을 할지 결정한다.
 * Workers 런타임(vinext dev 포함)에는 쓸 수 있는 파일 시스템이 없으므로 항상 끈다.
 */
export function shouldBackupHistoryToFile(env: {
  flag: string | undefined;
  nodeEnv: string | undefined;
  userAgent: string | undefined;
}): boolean {
  if (env.userAgent === "Cloudflare-Workers") return false;
  return String(env.flag) === "true" || String(env.nodeEnv) !== "production";
}
