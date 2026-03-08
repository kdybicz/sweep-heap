import { API_ERROR_CODE, type ApiErrorCode } from "@/lib/api-error";

type ApiErrorLike = {
  ok?: boolean;
  error?: string;
  code?: string;
};

export const readApiJsonResponse = async <T>(response: Pick<Response, "headers" | "json">) => {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return (await response.json()) as T;
};

export class HouseholdContextRedirectError extends Error {
  code: ApiErrorCode;
  redirectPath: "/household/select" | "/household/setup";

  constructor({
    code,
    error,
    redirectPath,
  }: {
    code: ApiErrorCode;
    error?: string;
    redirectPath: "/household/select" | "/household/setup";
  }) {
    super(error ?? "Household context recovery required");
    this.name = "HouseholdContextRedirectError";
    this.code = code;
    this.redirectPath = redirectPath;
  }
}

export const getHouseholdContextRedirectPath = (code?: string) => {
  switch (code) {
    case API_ERROR_CODE.HOUSEHOLD_REQUIRED:
      return "/household/setup" as const;
    case API_ERROR_CODE.HOUSEHOLD_NOT_FOUND:
    case API_ERROR_CODE.HOUSEHOLD_SELECTION_REQUIRED:
      return "/household/select" as const;
    default:
      return null;
  }
};

export const getHouseholdContextRedirectError = (data: ApiErrorLike | null | undefined) => {
  if (data?.ok !== false) {
    return null;
  }

  const redirectPath = getHouseholdContextRedirectPath(data?.code);
  if (!redirectPath || !data?.code) {
    return null;
  }

  return new HouseholdContextRedirectError({
    code: data.code as ApiErrorCode,
    error: data.error,
    redirectPath,
  });
};

export const recoverFromHouseholdContextError = (data: ApiErrorLike | null | undefined) => {
  const redirectError = getHouseholdContextRedirectError(data);
  if (!redirectError) {
    return false;
  }

  window.location.assign(redirectError.redirectPath);
  return true;
};
