export const toHouseholdInviteCompletePath = ({
  invitationId,
  secret,
}: {
  invitationId: number;
  secret: string;
}) => {
  const url = new URL("/api/households/invites/complete", "http://localhost");
  url.searchParams.set("invitationId", String(invitationId));
  url.searchParams.set("secret", secret);
  return `${url.pathname}${url.search}`;
};

export const toHouseholdInvitePagePath = ({
  error,
  invitationId,
  secret,
}: {
  error?: "invalid" | "sign-in" | "signout-failed" | "unexpected";
  invitationId: number;
  secret: string;
}) => {
  const url = new URL("/household/invite", "http://localhost");
  url.searchParams.set("invitationId", String(invitationId));
  url.searchParams.set("secret", secret);
  if (error) {
    url.searchParams.set("error", error);
  }
  return `${url.pathname}${url.search}`;
};

export const buildHouseholdInviteSignInRedirectUrl = ({
  email,
  invitationId,
  secret,
}: {
  email: string;
  invitationId: number;
  secret: string;
}) => {
  const url = new URL("/auth", "http://localhost");
  url.searchParams.set("email", email);
  url.searchParams.set(
    "callbackURL",
    toHouseholdInviteCompletePath({
      invitationId,
      secret,
    }),
  );
  return `${url.pathname}${url.search}`;
};
