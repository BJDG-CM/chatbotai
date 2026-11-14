import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldBackupHistoryToFile } from "./historyBackup";

const WORKERS = "Cloudflare-Workers";

test("Workers 런타임은 플래그가 true여도 파일 백업 안 함", () => {
  assert.equal(shouldBackupHistoryToFile({ flag: "true", nodeEnv: "development", userAgent: WORKERS }), false);
  assert.equal(shouldBackupHistoryToFile({ flag: undefined, nodeEnv: "development", userAgent: WORKERS }), false);
});

test("Node 런타임: 플래그 true 또는 비운영 환경이면 백업", () => {
  assert.equal(shouldBackupHistoryToFile({ flag: "true", nodeEnv: "production", userAgent: "Node.js/24" }), true);
  assert.equal(shouldBackupHistoryToFile({ flag: undefined, nodeEnv: "development", userAgent: undefined }), true);
});

test("운영 + 플래그 false는 백업 안 함", () => {
  assert.equal(shouldBackupHistoryToFile({ flag: "false", nodeEnv: "production", userAgent: "Node.js/24" }), false);
});
