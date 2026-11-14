export type ReadJsonResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 };

/**
 * 요청 본문을 maxBytes까지만 스트리밍으로 읽어 JSON으로 파싱한다.
 * Content-Length가 없거나 거짓이어도 실제로 읽은 바이트로 상한을 지킨다.
 */
export async function readJsonBody(
  request: { headers: Headers; body: ReadableStream<Uint8Array> | null },
  maxBytes: number,
): Promise<ReadJsonResult> {
  const declared = request.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared) > maxBytes) {
    return { ok: false, status: 413 };
  }
  if (!request.body) return { ok: false, status: 400 };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, status: 413 };
    }
    chunks.push(value);
  }

  // 청크 경계에서 UTF-8이 잘릴 수 있으므로 합친 뒤 한 번에 디코드한다.
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(merged)) };
  } catch {
    return { ok: false, status: 400 };
  }
}
