import { auth, getSession } from "@/auth";
import { sendHouseholdInviteEmail } from "@/lib/household-invite-email";
import {
  generateHouseholdInviteSecret,
  hashHouseholdInviteSecret,
} from "@/lib/household-invite-secret";
import { getAppOrigin } from "@/lib/http";
import {
  isInvitationNotFoundError,
  isInviteRecipientMismatchError,
  isOtherHouseholdError,
  type OrganizationInvitationLike,
  parsePositiveInt,
  toAuthApiError,
} from "@/lib/organization-api";
import {
  getPendingHouseholdInviteByIdAndSecret,
  setPendingHouseholdInviteSecretHash,
} from "@/lib/repositories";
import { withHouseholdMutationLock } from "@/lib/services/ownership-guard-service";

type HouseholdInviteRecord = NonNullable<
  Awaited<ReturnType<typeof getPendingHouseholdInviteByIdAndSecret>>
>;

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

export const getPendingHouseholdInvite = async ({
  invitationId,
  secret,
}: {
  invitationId: number;
  secret: string;
}): Promise<HouseholdInviteRecord | null> =>
  getPendingHouseholdInviteByIdAndSecret({
    inviteId: invitationId,
    secretHash: hashHouseholdInviteSecret(secret),
  });

export const getHouseholdInviteSessionEmail = async () =>
  (await getSession())?.user?.email?.trim().toLowerCase() ?? "";

export const hasMatchingHouseholdInviteSession = async (inviteEmail: string) => {
  const sessionEmail = await getHouseholdInviteSessionEmail();
  return !!sessionEmail && sessionEmail === inviteEmail.trim().toLowerCase();
};

export const acceptHouseholdInvite = async ({
  householdId,
  invitationId,
  requestHeaders,
}: {
  householdId: number;
  invitationId: number;
  requestHeaders: Headers;
}) => {
  try {
    const responseHeaders = await withHouseholdMutationLock({
      householdId,
      task: async () => {
        await auth.api.acceptInvitation({
          body: {
            invitationId: String(invitationId),
          },
          headers: requestHeaders,
        });

        const setActiveResponse = await auth.api.setActiveOrganization({
          asResponse: true,
          body: {
            organizationId: String(householdId),
          },
          headers: requestHeaders,
        });
        const responseHeaders = new Headers();
        for (const [key, value] of setActiveResponse.headers.entries()) {
          if (key.toLowerCase() === "set-cookie") {
            responseHeaders.append(key, value);
          }
        }

        return responseHeaders;
      },
    });

    return {
      ok: true as const,
      responseHeaders,
    };
  } catch (error) {
    const authApiError = toAuthApiError(error);
    if (isInvitationNotFoundError(authApiError)) {
      return {
        ok: false as const,
        reason: "invalid" as const,
      };
    }

    if (isOtherHouseholdError(authApiError)) {
      return {
        ok: false as const,
        reason: "other-household" as const,
      };
    }

    if (isInviteRecipientMismatchError(authApiError)) {
      return {
        ok: false as const,
        reason: "recipient-mismatch" as const,
      };
    }

    return {
      ok: false as const,
      reason: "unexpected" as const,
      error,
    };
  }
};

export const sendHouseholdInvite = async ({
  householdId,
  householdName,
  invite,
  inviterName,
  request,
}: {
  householdId: number;
  householdName: string;
  invite: OrganizationInvitationLike;
  inviterName: string;
  request: Request;
}) => {
  const inviteId = parsePositiveInt(invite.id);
  if (inviteId === null) {
    throw new Error("Invalid invitation id");
  }

  const inviteSecret = generateHouseholdInviteSecret();
  const inviteSecretHash = hashHouseholdInviteSecret(inviteSecret);
  const storedInviteId = await setPendingHouseholdInviteSecretHash({
    inviteId,
    secretHash: inviteSecretHash,
  });
  if (storedInviteId === null) {
    throw new Error("Failed to store invitation secret");
  }

  const appOrigin = getAppOrigin(request);
  const inviteUrl = new URL("/household/invite", appOrigin);
  inviteUrl.searchParams.set("invitationId", String(inviteId));
  inviteUrl.searchParams.set("secret", inviteSecret);

  let inviteEmailSent = false;
  try {
    await sendHouseholdInviteEmail({
      householdName,
      inviteUrl: inviteUrl.toString(),
      inviterName,
      to: invite.email,
    });
    inviteEmailSent = true;
  } catch (error) {
    console.error("Failed to send household invite email", {
      householdId,
      inviteId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    inviteId,
    inviteEmailSent,
  };
};
