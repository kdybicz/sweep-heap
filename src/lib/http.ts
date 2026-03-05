export const parseJsonObjectBody = async (request: Request) => {
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
};

export const getAppOrigin = (request: Request) => {
  const appUrl = process.env.AUTH_URL;
  if (appUrl) {
    try {
      return new URL(appUrl).origin;
    } catch {}
  }

  return new URL(request.url).origin;
};
