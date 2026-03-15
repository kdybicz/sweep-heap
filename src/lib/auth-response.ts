export const assertOkResponse = (response: Response, message: string) => {
  if (!response.ok) {
    throw new Error(`${message} (status ${response.status})`);
  }
};

export const appendSetCookieHeaders = (target: Headers, source: Headers) => {
  for (const [key, value] of source.entries()) {
    if (key.toLowerCase() === "set-cookie") {
      target.append(key, value);
    }
  }
};

export const copySetCookieHeaders = (source: Headers) => {
  const responseHeaders = new Headers();
  appendSetCookieHeaders(responseHeaders, source);
  return responseHeaders;
};

export const hasSetCookieHeaders = (headers: Headers) => {
  for (const [key] of headers.entries()) {
    if (key.toLowerCase() === "set-cookie") {
      return true;
    }
  }

  return false;
};
