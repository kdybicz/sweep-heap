import { APIError, betterAuth } from "better-auth";
import { magicLink, organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";
import { headers } from "next/headers";
import nodemailer from "nodemailer";

import { pool } from "@/lib/db";
import { getSmtpSettings } from "@/lib/smtp";

const appUrl = process.env.AUTH_URL;

const getMagicLinkTransport = () => {
  const smtpSettings = getSmtpSettings();
  if (!smtpSettings.host || !smtpSettings.from) {
    throw new Error("Email is not configured");
  }

  return {
    from: smtpSettings.from,
    transporter: nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.secure,
      auth: smtpSettings.auth,
    }),
  };
};

const magicLinkHtml = ({ url, host }: { url: string; host: string }) => {
  const escapedHost = host.replace(/\./g, "&#8203;.");
  const brandColor = "#346df1";
  const color = {
    background: "#f9f9f9",
    text: "#444",
    mainBackground: "#fff",
    buttonBackground: brandColor,
    buttonBorder: brandColor,
    buttonText: "#fff",
  };

  return `<body style="background: ${color.background};">
  <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${color.mainBackground}; max-width: 600px; margin: auto; border-radius: 10px;">
    <tr>
      <td align="center" style="padding: 10px 0; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        Sign in to <strong>${escapedHost}</strong>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 10px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="border-radius: 5px;" bgcolor="${color.buttonBackground}">
              <a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${color.buttonText}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${color.buttonBorder}; display: inline-block; font-weight: bold;">
                Sign in
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 10px 0; font-size: 14px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        If you did not request this email, you can safely ignore it.
      </td>
    </tr>
  </table>
</body>`;
};

const magicLinkText = ({ url, host }: { url: string; host: string }) =>
  `Sign in to ${host}\n${url}\n\n`;

const organizationAccessControl = createAccessControl(defaultStatements);

const householdAdminRole = organizationAccessControl.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
});

const householdOwnerRole = organizationAccessControl.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
});

const householdMemberRole = organizationAccessControl.newRole({
  organization: [],
  member: [],
  invitation: ["create"],
  team: [],
  ac: ["read"],
});

const toUserId = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

const findActiveHouseholdIdByUserId = async (userId: number) => {
  const result = await pool.query<{ householdId: number }>(
    "select household_id as \"householdId\" from household_memberships where user_id = $1 and status = 'active' order by joined_at desc limit 1",
    [userId],
  );

  return result.rows[0]?.householdId ?? null;
};

const findUserIdByEmail = async (email: string) => {
  const result = await pool.query<{ id: number }>(
    "select id from users where lower(email) = lower($1) limit 1",
    [email.trim().toLowerCase()],
  );

  return result.rows[0]?.id ?? null;
};

const ensureCanJoinHousehold = async ({
  householdId,
  userId,
}: {
  householdId: number;
  userId: number;
}) => {
  const activeHouseholdId = await findActiveHouseholdIdByUserId(userId);
  if (activeHouseholdId !== null && activeHouseholdId !== householdId) {
    throw new APIError("CONFLICT", {
      message: "You already belong to another household",
    });
  }
};

export const auth = betterAuth({
  appName: "The Sweep Heap",
  baseURL: appUrl,
  trustedOrigins: appUrl ? [appUrl] : ["http://localhost:3000"],
  database: pool,
  advanced: {
    database: {
      generateId: "serial",
    },
  },
  user: {
    modelName: "users",
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    modelName: "sessions",
    fields: {
      userId: "user_id",
      token: "token",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  account: {
    modelName: "accounts",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "verification",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  plugins: [
    magicLink({
      expiresIn: 24 * 60 * 60,
      sendMagicLink: async ({ email, url }) => {
        const host = new URL(url).host;
        const { from, transporter } = getMagicLinkTransport();
        await transporter.sendMail({
          to: email,
          from,
          subject: `Sign in to ${host}`,
          text: magicLinkText({ url, host }),
          html: magicLinkHtml({ url, host }),
        });
      },
    }),
    organization({
      ac: organizationAccessControl,
      creatorRole: "owner",
      invitationExpiresIn: 7 * 24 * 60 * 60,
      roles: {
        admin: householdAdminRole,
        owner: householdOwnerRole,
        member: householdMemberRole,
      },
      allowUserToCreateOrganization: async (user) => {
        const userId = toUserId(user.id);
        if (userId === null) {
          return false;
        }

        const activeHouseholdId = await findActiveHouseholdIdByUserId(userId);
        return activeHouseholdId === null;
      },
      organizationHooks: {
        beforeAcceptInvitation: async ({ invitation, user }) => {
          const userId = toUserId(user.id);
          const householdId = toUserId(invitation.organizationId);
          if (userId === null || householdId === null) {
            return;
          }

          await ensureCanJoinHousehold({ householdId, userId });
        },
        beforeAddMember: async ({ member }) => {
          const userId = toUserId(member.userId);
          const householdId = toUserId(member.organizationId);
          if (userId === null || householdId === null) {
            return;
          }

          await ensureCanJoinHousehold({ householdId, userId });
        },
        beforeCreateInvitation: async ({ invitation, organization }) => {
          const invitedUserId = await findUserIdByEmail(invitation.email);
          if (invitedUserId === null) {
            return;
          }

          const householdId = toUserId(organization.id);
          if (householdId === null) {
            return;
          }

          await ensureCanJoinHousehold({
            householdId,
            userId: invitedUserId,
          });
        },
      },
      schema: {
        session: {
          fields: {
            activeOrganizationId: "active_household_id",
          },
        },
        organization: {
          modelName: "households",
          fields: {
            name: "name",
            slug: "slug",
            logo: "icon",
            metadata: "metadata",
            createdAt: "created_at",
          },
          additionalFields: {
            timeZone: {
              type: "string",
              fieldName: "time_zone",
              required: true,
              defaultValue: "UTC",
            },
          },
        },
        member: {
          modelName: "household_memberships",
          fields: {
            organizationId: "household_id",
            userId: "user_id",
            role: "role",
            createdAt: "joined_at",
          },
          additionalFields: {
            status: {
              type: "string",
              fieldName: "status",
              required: true,
              input: false,
              defaultValue: "active",
            },
          },
        },
        invitation: {
          modelName: "household_member_invites",
          fields: {
            organizationId: "household_id",
            email: "email",
            role: "role",
            status: "status",
            expiresAt: "expires_at",
            createdAt: "created_at",
            inviterId: "invited_by_user_id",
          },
        },
      },
    }),
  ],
});

export const getSession = async () => auth.api.getSession({ headers: await headers() });
