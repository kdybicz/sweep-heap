import { createHash, randomBytes } from "node:crypto";

import { getSession } from "@/auth";
import { sendHouseholdInviteEmail } from "@/lib/household-invite-email";
import { getAppOrigin } from "@/lib/http";
import {
  getActiveHouseholdSummary,
  resendPendingHouseholdInvite,
  revokePendingHouseholdInvite,
} from "@/lib/repositories";

export const dynamic = "force-dynamic";

const inviteExpiryInDays = 7;

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
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) {
    return Response.json({ ok: false, error: "Invalid user" }, { status: 400 });
  }

  const household = await getActiveHouseholdSummary(userId);
  if (!household) {
    return Response.json({ ok: false, error: "Household required" }, { status: 404 });
  }

  const resolvedParams = await params;
  const inviteId = parseInviteId(resolvedParams.inviteId);
  if (inviteId === null) {
    return Response.json({ ok: false, error: "Invite id is required" }, { status: 400 });
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const identifier = `household-invite-${household.id}-${randomBytes(12).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + inviteExpiryInDays * 24 * 60 * 60 * 1000);

  const invite = await resendPendingHouseholdInvite({
    expiresAt,
    householdId: household.id,
    identifier,
    inviteId,
    invitedByUserId: userId,
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
    session.user.name?.trim() || session.user.email?.trim() || "A household member";

  let inviteEmailSent = false;
  try {
    await sendHouseholdInviteEmail({
      householdName: household.name,
      inviteUrl: inviteUrl.toString(),
      inviterName,
      to: invite.email,
    });
    inviteEmailSent = true;
  } catch {}

  return Response.json({
    ok: true,
    invite,
    inviteEmailSent,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) {
    return Response.json({ ok: false, error: "Invalid user" }, { status: 400 });
  }

  const household = await getActiveHouseholdSummary(userId);
  if (!household) {
    return Response.json({ ok: false, error: "Household required" }, { status: 404 });
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
}
