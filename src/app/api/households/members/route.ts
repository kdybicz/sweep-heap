import { createHash, randomBytes } from "node:crypto";

import { requireApiHousehold, requireApiHouseholdAdmin } from "@/lib/api-access";
import { getHouseholdInviteExpiryDate } from "@/lib/household-invite";
import { sendHouseholdInviteEmail } from "@/lib/household-invite-email";
import { getAppOrigin, parseJsonObjectBody } from "@/lib/http";
import {
  createHouseholdMemberInvite,
  listActiveHouseholdMembers,
  listPendingHouseholdInvites,
  removeActiveHouseholdMemberWithGuard,
  updateActiveHouseholdMemberRoleWithGuard,
} from "@/lib/repositories";
import type { HouseholdMemberRole } from "@/lib/repositories/household-repository";

export const dynamic = "force-dynamic";

const householdRoles: HouseholdMemberRole[] = ["admin", "member"];

const isHouseholdRole = (value: unknown): value is HouseholdMemberRole =>
  typeof value === "string" && householdRoles.includes(value as HouseholdMemberRole);

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const handleUnexpectedError = (
  action: "list" | "invite" | "update-role" | "remove-member",
  error: unknown,
) => {
  const message =
    action === "list"
      ? "Failed to load household members"
      : action === "invite"
        ? "Failed to create household invite"
        : action === "update-role"
          ? "Failed to update member role"
          : "Failed to remove household member";

  console.error(message, error);
  return Response.json({ ok: false, error: message }, { status: 500 });
};

export async function GET() {
  try {
    const householdAccess = await requireApiHousehold();
    if (!householdAccess.ok) {
      return householdAccess.response;
    }

    const { household, sessionContext } = householdAccess;

    const [members, pendingInvites] = await Promise.all([
      listActiveHouseholdMembers(household.id),
      listPendingHouseholdInvites(household.id),
    ]);

    return Response.json({
      ok: true,
      household: {
        id: household.id,
        name: household.name,
        role: household.role,
      },
      viewerUserId: sessionContext.userId,
      canAdministerMembers: household.role === "admin",
      members,
      pendingInvites,
    });
  } catch (error) {
    return handleUnexpectedError("list", error);
  }
}

export async function POST(request: Request) {
  try {
    const householdAccess = await requireApiHousehold();
    if (!householdAccess.ok) {
      return householdAccess.response;
    }

    const { household, sessionContext } = householdAccess;

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email || !isValidEmail(email)) {
      return Response.json({ ok: false, error: "Valid email is required" }, { status: 400 });
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const identifier = `household-invite-${household.id}-${randomBytes(12).toString("base64url")}`;
    const expiresAt = getHouseholdInviteExpiryDate();

    const inviteResult = await createHouseholdMemberInvite({
      email,
      expiresAt,
      householdId: household.id,
      identifier,
      invitedByUserId: sessionContext.userId,
      role: "member",
      tokenHash,
    });

    if (inviteResult.status === "already_member") {
      return Response.json(
        { ok: false, error: "User is already in this household" },
        { status: 409 },
      );
    }

    if (inviteResult.status === "already_invited") {
      return Response.json(
        {
          ok: false,
          error: "Invite already pending for this email. Resend or revoke the existing invite.",
          existingInvite: inviteResult.invite,
        },
        { status: 409 },
      );
    }

    if (inviteResult.status === "belongs_to_other_household") {
      return Response.json(
        { ok: false, error: "User already belongs to another household" },
        { status: 409 },
      );
    }

    let inviteEmailSent = false;
    const appOrigin = getAppOrigin(request);
    const inviteUrl = new URL("/household/invite", appOrigin);
    inviteUrl.searchParams.set("identifier", identifier);
    inviteUrl.searchParams.set("token", token);
    const inviterName =
      sessionContext.sessionUserName?.trim() ||
      sessionContext.sessionUserEmail?.trim() ||
      "A household member";

    try {
      await sendHouseholdInviteEmail({
        householdName: household.name,
        inviteUrl: inviteUrl.toString(),
        inviterName,
        to: inviteResult.invite.email,
      });
      inviteEmailSent = true;
    } catch (error) {
      console.error("Failed to send household invite email", {
        householdId: household.id,
        inviteId: inviteResult.invite.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return Response.json({
      ok: true,
      invite: inviteResult.invite,
      inviteEmailSent,
    });
  } catch (error) {
    return handleUnexpectedError("invite", error);
  }
}

export async function PATCH(request: Request) {
  try {
    const adminAccess = await requireApiHouseholdAdmin();
    if (!adminAccess.ok) {
      return adminAccess.response;
    }

    const { household, sessionContext } = adminAccess;

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const targetUserId = Number(payload.userId);
    if (!Number.isFinite(targetUserId)) {
      return Response.json({ ok: false, error: "Member user id is required" }, { status: 400 });
    }

    if (!isHouseholdRole(payload.role)) {
      return Response.json({ ok: false, error: "Role must be admin or member" }, { status: 400 });
    }

    if (targetUserId === sessionContext.userId) {
      return Response.json(
        { ok: false, error: "Admins cannot change their own role" },
        { status: 400 },
      );
    }

    const updatedMemberResult = await updateActiveHouseholdMemberRoleWithGuard({
      householdId: household.id,
      userId: targetUserId,
      role: payload.role,
    });

    if (updatedMemberResult.status === "member_not_found") {
      return Response.json({ ok: false, error: "Member not found" }, { status: 404 });
    }

    if (updatedMemberResult.status === "last_admin") {
      return Response.json(
        { ok: false, error: "At least one admin must remain in the household" },
        { status: 409 },
      );
    }

    return Response.json({ ok: true, member: updatedMemberResult.member });
  } catch (error) {
    return handleUnexpectedError("update-role", error);
  }
}

export async function DELETE(request: Request) {
  try {
    const adminAccess = await requireApiHouseholdAdmin();
    if (!adminAccess.ok) {
      return adminAccess.response;
    }

    const { household, sessionContext } = adminAccess;

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const targetUserId = Number(payload.userId);
    if (!Number.isFinite(targetUserId)) {
      return Response.json({ ok: false, error: "Member user id is required" }, { status: 400 });
    }

    if (targetUserId === sessionContext.userId) {
      return Response.json(
        { ok: false, error: "Admins cannot remove themselves" },
        { status: 400 },
      );
    }

    const removedMemberResult = await removeActiveHouseholdMemberWithGuard({
      householdId: household.id,
      userId: targetUserId,
    });

    if (removedMemberResult.status === "member_not_found") {
      return Response.json({ ok: false, error: "Member not found" }, { status: 404 });
    }

    if (removedMemberResult.status === "last_admin") {
      return Response.json(
        { ok: false, error: "At least one admin must remain in the household" },
        { status: 409 },
      );
    }

    return Response.json({ ok: true, removedUserId: removedMemberResult.userId });
  } catch (error) {
    return handleUnexpectedError("remove-member", error);
  }
}
