export const parseE2EAppURL = (value) => {
  const errorMessage =
    "E2E_BASE_URL must be a local HTTP origin without credentials, path, query, or fragment, e.g. http://127.0.0.1:3100";
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(errorMessage);
  }
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.protocol !== "http:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(errorMessage);
  }
  return url;
};
