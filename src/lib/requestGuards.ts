const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function reject(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * 상태를 바꾸는 요청(POST/PUT/PATCH/DELETE)이 같은 출처에서 왔는지,
 * JSON 라우트라면 Content-Type이 application/json인지 확인한다.
 * 통과하면 null, 거부하면 응답을 돌려준다. Origin 검사가 먼저다.
 */
export function checkMutationRequest(request: Request, options: { json: boolean }): Response | null {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return null;

  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return reject("허용되지 않은 요청입니다.", 403);
  }

  if (options.json) {
    const mediaType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (mediaType !== "application/json") {
      return reject("JSON 형식의 요청만 허용됩니다.", 415);
    }
  }
  return null;
}
