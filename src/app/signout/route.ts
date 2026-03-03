import { headers } from "next/headers";

import { auth } from "@/auth";

export async function GET(request: Request) {
  const signOutResponse = await auth.api.signOut({
    headers: await headers(),
    asResponse: true,
  });

  const responseHeaders = new Headers(signOutResponse.headers);
  responseHeaders.set("location", new URL("/", request.url).toString());

  return new Response(null, {
    status: 302,
    headers: responseHeaders,
  });
}
