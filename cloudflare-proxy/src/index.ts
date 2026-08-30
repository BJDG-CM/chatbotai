const PLACEHOLDER_ORIGIN = "replace-with-your-vercel-project.vercel.app";

function configurationError(): Response {
  return Response.json(
    { error: "Chatbot origin is not configured." },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    }
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const publicUrl = new URL(request.url);
    if (publicUrl.pathname !== "/chatbot" && !publicUrl.pathname.startsWith("/chatbot/")) {
      return new Response("Not found", { status: 404 });
    }

    const originHost = env.ORIGIN_HOST.trim().toLowerCase();
    if (!originHost || originHost === PLACEHOLDER_ORIGIN || originHost.includes("://")) {
      return configurationError();
    }

    const upstreamUrl = new URL(publicUrl);
    upstreamUrl.protocol = "https:";
    upstreamUrl.hostname = originHost;
    upstreamUrl.port = "";

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("X-Forwarded-Host", publicUrl.host);
    requestHeaders.set("X-Forwarded-Proto", "https");

    try {
      const upstreamResponse = await fetch(
        new Request(upstreamUrl, {
          method: request.method,
          headers: requestHeaders,
          body: request.body,
          redirect: "manual",
        })
      );

      const responseHeaders = new Headers(upstreamResponse.headers);
      const location = responseHeaders.get("Location");
      if (location) {
        const redirectUrl = new URL(location, upstreamUrl);
        if (redirectUrl.hostname === originHost) {
          redirectUrl.protocol = publicUrl.protocol;
          redirectUrl.host = publicUrl.host;
          responseHeaders.set("Location", redirectUrl.toString());
        }
      }
      responseHeaders.set("X-Robots-Tag", "noindex, nofollow, noarchive");

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "chatbot_origin_fetch_failed",
          message: error instanceof Error ? error.message : "Unknown upstream error",
        })
      );
      return Response.json(
        { error: "Chatbot origin is temporarily unavailable." },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }
  },
} satisfies ExportedHandler<Env>;
