import { auth } from "@/auth";
import { getSafeLocalPath } from "@/lib/safe-local-path";

const parseSignOutForm = async (request: Request) => {
  const body = new URLSearchParams(await request.text());

  return {
    redirectTo: getSafeLocalPath(body.get("redirectTo") ?? "", "/", { decode: false }),
    failureRedirectTo: getSafeLocalPath(body.get("failureRedirectTo") ?? "", "", {
      decode: false,
    }),
  };
};

const assertOkResponse = (response: Response, message: string) => {
  if (!response.ok) {
    throw new Error(`${message} (status ${response.status})`);
  }
};

const isSameOriginPost = (request: Request) => {
  const requestOrigin = new URL(request.url).origin;
  const originHeader = request.headers.get("origin");
  if (originHeader) {
    return originHeader === requestOrigin;
  }

  const refererHeader = request.headers.get("referer");
  if (!refererHeader) {
    return false;
  }

  try {
    return new URL(refererHeader).origin === requestOrigin;
  } catch {
    return false;
  }
};

const redirectToPath = (path: string, request: Request) =>
  Response.redirect(new URL(path, request.url).toString(), 303);

export async function POST(request: Request) {
  const { failureRedirectTo, redirectTo } = await parseSignOutForm(request);

  if (!isSameOriginPost(request)) {
    return new Response(null, { status: 403 });
  }

  try {
    const signOutResponse = await auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    });
    assertOkResponse(signOutResponse, "Sign out failed");

    const responseHeaders = new Headers(signOutResponse.headers);
    responseHeaders.set("location", new URL(redirectTo, request.url).toString());

    return new Response(null, {
      status: 303,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Failed to sign out", error);
    return failureRedirectTo
      ? redirectToPath(failureRedirectTo, request)
      : new Response(null, { status: 500 });
  }
}

export async function GET() {
  return new Response(null, { status: 405 });
}
