import { betterAuth } from "better-auth";
import { magicLink, organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";
import { headers } from "next/headers";

import { pool } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email/send-transactional-email";
import { renderMagicLinkEmail } from "@/lib/email/templates/magic-link-email";
import { parsePositiveInt } from "@/lib/organization-api";

const appUrl = process.env.AUTH_URL;

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
        const { html, text } = await renderMagicLinkEmail({
          email,
          host,
          url,
        });
        await sendTransactionalEmail({
          html,
          subject: `Sign in to ${host}`,
          text,
          to: email,
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
        const userId = parsePositiveInt(user.id);
        return userId !== null;
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
