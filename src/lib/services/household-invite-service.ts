import { auth, getSession } from "@/auth";
import { assertOkResponse, copySetCookieHeaders } from "@/lib/auth-response";
import { sendHouseholdInviteEmail } from "@/lib/household-invite-email";
import { toHouseholdInvitePagePath } from "@/lib/household-invite-paths";
import {
  generateHouseholdInviteSecret,
  hashHouseholdInviteSecret,
} from "@/lib/household-invite-secret";
import { getAppOrigin } from "@/lib/http";
import {
  isInvitationNotFoundError,
  isInviteRecipientMismatchError,
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
    const outcome = await withHouseholdMutationLock({
      householdId,
      task: async () => {
        await auth.api.acceptInvitation({
          body: {
            invitationId: String(invitationId),
          },
          headers: requestHeaders,
        });

        let responseHeaders = new Headers();
        try {
          const setActiveResponse = await auth.api.setActiveOrganization({
            asResponse: true,
            body: {
              organizationId: String(householdId),
            },
            headers: requestHeaders,
          });
          responseHeaders = copySetCookieHeaders(setActiveResponse.headers);
          assertOkResponse(setActiveResponse, "Activate household after invite accept failed");

          return {
            activeHouseholdActivated: true as const,
            nextPath: "/household" as const,
            responseHeaders,
          };
        } catch (error) {
          console.error("Accepted household invite but failed to activate household", error);

          return {
            activeHouseholdActivated: false as const,
            nextPath: "/household/select" as const,
            responseHeaders,
          };
        }
      },
    });

    return {
      ok: true as const,
      ...outcome,
    };
  } catch (error) {
    const authApiError = toAuthApiError(error);
    if (isInvitationNotFoundError(authApiError)) {
      return {
        ok: false as const,
        reason: "invalid" as const,
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
  const inviteUrl = new URL(
    toHouseholdInvitePagePath({
      invitationId: inviteId,
      secret: inviteSecret,
    }),
    appOrigin,
  );

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
