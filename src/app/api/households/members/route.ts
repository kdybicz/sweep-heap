import { createHash, randomBytes } from "node:crypto";
import { getSession } from "@/auth";
import { sendHouseholdInviteEmail } from "@/lib/household-invite-email";
import { getAppOrigin, parseJsonObjectBody } from "@/lib/http";
import {
  countActiveHouseholdAdmins,
  createHouseholdMemberInvite,
  getActiveHouseholdMember,
  getActiveHouseholdSummary,
  listActiveHouseholdMembers,
  listPendingHouseholdInvites,
  removeActiveHouseholdMember,
  updateActiveHouseholdMemberRole,
} from "@/lib/repositories";
import type { HouseholdMemberRole } from "@/lib/repositories/household-repository";

export const dynamic = "force-dynamic";

const householdRoles: HouseholdMemberRole[] = ["admin", "member"];

const isHouseholdRole = (value: unknown): value is HouseholdMemberRole =>
  typeof value === "string" && householdRoles.includes(value as HouseholdMemberRole);

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const inviteExpiryInDays = 7;

const getSessionContext = async () => {
  const session = await getSession();
  if (!session?.user?.id) {
    return {
      session,
      userId: null,
      status: 401,
      error: "Unauthorized",
    };
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) {
    return {
      session,
      userId: null,
      status: 400,
      error: "Invalid user",
    };
  }

  return {
    session,
    userId,
    status: 200,
    error: null,
  };
};

export async function GET() {
  const sessionContext = await getSessionContext();
  if (sessionContext.error || sessionContext.userId === null) {
    return Response.json(
      { ok: false, error: sessionContext.error ?? "Unauthorized" },
      { status: sessionContext.status },
    );
  }

  const household = await getActiveHouseholdSummary(sessionContext.userId);
  if (!household) {
    return Response.json({ ok: false, error: "Household required" }, { status: 403 });
  }

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
    canManageMembers: household.role === "admin",
    members,
    pendingInvites,
  });
}

export async function POST(request: Request) {
  const sessionContext = await getSessionContext();
  if (sessionContext.error || sessionContext.userId === null) {
    return Response.json(
      { ok: false, error: sessionContext.error ?? "Unauthorized" },
      { status: sessionContext.status },
    );
  }

  const household = await getActiveHouseholdSummary(sessionContext.userId);
  if (!household) {
    return Response.json({ ok: false, error: "Household required" }, { status: 403 });
  }

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
  const expiresAt = new Date(Date.now() + inviteExpiryInDays * 24 * 60 * 60 * 1000);

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
    sessionContext.session.user.name?.trim() ||
    sessionContext.session.user.email?.trim() ||
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
}

export async function PATCH(request: Request) {
  const sessionContext = await getSessionContext();
  if (sessionContext.error || sessionContext.userId === null) {
    return Response.json(
      { ok: false, error: sessionContext.error ?? "Unauthorized" },
      { status: sessionContext.status },
    );
  }

  const household = await getActiveHouseholdSummary(sessionContext.userId);
  if (!household) {
    return Response.json({ ok: false, error: "Household required" }, { status: 403 });
  }

  if (household.role !== "admin") {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

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

  const member = await getActiveHouseholdMember({
    householdId: household.id,
    userId: targetUserId,
  });
  if (!member) {
    return Response.json({ ok: false, error: "Member not found" }, { status: 404 });
  }

  if (member.role === "admin" && payload.role !== "admin") {
    const adminCount = await countActiveHouseholdAdmins(household.id);
    if (adminCount <= 1) {
      return Response.json(
        { ok: false, error: "At least one admin must remain in the household" },
        { status: 409 },
      );
    }
  }

  const updatedMember = await updateActiveHouseholdMemberRole({
    householdId: household.id,
    userId: targetUserId,
    role: payload.role,
  });

  if (!updatedMember) {
    return Response.json({ ok: false, error: "Member not found" }, { status: 404 });
  }

  return Response.json({ ok: true, member: updatedMember });
}

export async function DELETE(request: Request) {
  const sessionContext = await getSessionContext();
  if (sessionContext.error || sessionContext.userId === null) {
    return Response.json(
      { ok: false, error: sessionContext.error ?? "Unauthorized" },
      { status: sessionContext.status },
    );
  }

  const household = await getActiveHouseholdSummary(sessionContext.userId);
  if (!household) {
    return Response.json({ ok: false, error: "Household required" }, { status: 403 });
  }

  if (household.role !== "admin") {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const payload = await parseJsonObjectBody(request);
  if (payload === null) {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const targetUserId = Number(payload.userId);
  if (!Number.isFinite(targetUserId)) {
    return Response.json({ ok: false, error: "Member user id is required" }, { status: 400 });
  }

  if (targetUserId === sessionContext.userId) {
    return Response.json({ ok: false, error: "Admins cannot remove themselves" }, { status: 400 });
  }

  const member = await getActiveHouseholdMember({
    householdId: household.id,
    userId: targetUserId,
  });
  if (!member) {
    return Response.json({ ok: false, error: "Member not found" }, { status: 404 });
  }

  if (member.role === "admin") {
    const adminCount = await countActiveHouseholdAdmins(household.id);
    if (adminCount <= 1) {
      return Response.json(
        { ok: false, error: "At least one admin must remain in the household" },
        { status: 409 },
      );
    }
  }

  const removedUserId = await removeActiveHouseholdMember({
    householdId: household.id,
    userId: targetUserId,
  });

  if (!removedUserId) {
    return Response.json({ ok: false, error: "Member not found" }, { status: 404 });
  }

  return Response.json({ ok: true, removedUserId });
}
