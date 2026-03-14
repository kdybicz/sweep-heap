export const getSafeLocalPath = (
  value: string,
  fallbackPath: string,
  { decode = true }: { decode?: boolean } = {},
) => {
  const isSafeLocalPath = (candidate: string) => {
    const pathPart = candidate.split(/[?#]/, 1)[0] ?? candidate;

    return (
      candidate.startsWith("/") &&
      !candidate.startsWith("//") &&
      !candidate.startsWith("/\\") &&
      !pathPart.includes("\\") &&
      !/%2f|%5c/i.test(pathPart)
    );
  };

  const candidates = [value];

  if (decode) {
    try {
      candidates.unshift(decodeURIComponent(value));
    } catch {}
  }

  for (const candidate of candidates) {
    if (isSafeLocalPath(candidate)) {
      return candidate;
    }
  }

  return fallbackPath;
};
