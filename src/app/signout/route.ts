import { headers } from "next/headers";

import { auth } from "@/auth";
import { getSafeLocalPath } from "@/lib/safe-local-path";

const assertOkResponse = (response: Response, message: string) => {
  if (!response.ok) {
    throw new Error(`${message} (status ${response.status})`);
  }
};

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const redirectTo = getSafeLocalPath(requestUrl.searchParams.get("redirectTo") ?? "", "/", {
      decode: false,
    });
    const signOutResponse = await auth.api.signOut({
      headers: await headers(),
      asResponse: true,
    });
    assertOkResponse(signOutResponse, "Sign out failed");

    const responseHeaders = new Headers(signOutResponse.headers);
    responseHeaders.set("location", new URL(redirectTo, request.url).toString());

    return new Response(null, {
      status: 302,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Failed to sign out", error);
    return new Response(null, { status: 500 });
  }
}
