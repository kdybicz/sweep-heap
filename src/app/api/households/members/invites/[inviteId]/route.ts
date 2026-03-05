import { createHash, randomBytes } from "node:crypto";

import { getHouseholdInviteExpiryDate } from "@/lib/household-invite";
import { sendHouseholdInviteEmail } from "@/lib/household-invite-email";
import { getAppOrigin } from "@/lib/http";
import {
  getActiveHouseholdSummary,
  resendPendingHouseholdInvite,
  revokePendingHouseholdInvite,
} from "@/lib/repositories";
import { getSessionContext, sessionErrorResponse } from "@/lib/session-context";

export const dynamic = "force-dynamic";

const parseInviteId = (rawValue: string) => {
  const inviteId = Number(rawValue);
  if (!Number.isInteger(inviteId) || inviteId <= 0) {
    return null;
  }
  return inviteId;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  try {
    const sessionContext = await getSessionContext();
    if (!sessionContext.ok) {
      return sessionErrorResponse(sessionContext);
    }

    const household = await getActiveHouseholdSummary(sessionContext.userId);
    if (!household) {
      return Response.json({ ok: false, error: "Household required" }, { status: 403 });
    }

    const resolvedParams = await params;
    const inviteId = parseInviteId(resolvedParams.inviteId);
    if (inviteId === null) {
      return Response.json({ ok: false, error: "Invite id is required" }, { status: 400 });
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const identifier = `household-invite-${household.id}-${randomBytes(12).toString("base64url")}`;
    const expiresAt = getHouseholdInviteExpiryDate();

    const invite = await resendPendingHouseholdInvite({
      expiresAt,
      householdId: household.id,
      identifier,
      inviteId,
      invitedByUserId: sessionContext.userId,
      tokenHash,
    });
    if (!invite) {
      return Response.json({ ok: false, error: "Pending invite not found" }, { status: 404 });
    }

    const appOrigin = getAppOrigin(request);
    const inviteUrl = new URL("/household/invite", appOrigin);
    inviteUrl.searchParams.set("identifier", identifier);
    inviteUrl.searchParams.set("token", token);

    const inviterName =
      sessionContext.sessionUserName?.trim() ||
      sessionContext.sessionUserEmail?.trim() ||
      "A household member";

    let inviteEmailSent = false;
    try {
      await sendHouseholdInviteEmail({
        householdName: household.name,
        inviteUrl: inviteUrl.toString(),
        inviterName,
        to: invite.email,
      });
      inviteEmailSent = true;
    } catch (error) {
      console.error("Failed to resend household invite email", {
        householdId: household.id,
        inviteId: invite.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return Response.json({
      ok: true,
      invite,
      inviteEmailSent,
    });
  } catch (error) {
    console.error("Failed to resend household invite", error);
    return Response.json(
      { ok: false, error: "Failed to resend household invite" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  try {
    const sessionContext = await getSessionContext();
    if (!sessionContext.ok) {
      return sessionErrorResponse(sessionContext);
    }

    const household = await getActiveHouseholdSummary(sessionContext.userId);
    if (!household) {
      return Response.json({ ok: false, error: "Household required" }, { status: 403 });
    }

    if (household.role !== "admin") {
      return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const resolvedParams = await params;
    const inviteId = parseInviteId(resolvedParams.inviteId);
    if (inviteId === null) {
      return Response.json({ ok: false, error: "Invite id is required" }, { status: 400 });
    }

    const revokedInviteId = await revokePendingHouseholdInvite({
      householdId: household.id,
      inviteId,
    });
    if (!revokedInviteId) {
      return Response.json({ ok: false, error: "Pending invite not found" }, { status: 404 });
    }

    return Response.json({
      ok: true,
      revokedInviteId,
    });
  } catch (error) {
    console.error("Failed to revoke household invite", error);
    return Response.json(
      { ok: false, error: "Failed to revoke household invite" },
      { status: 500 },
    );
  }
}
