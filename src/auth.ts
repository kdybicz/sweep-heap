import PostgresAdapter from "@auth/pg-adapter";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { pool } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;

  const smtpAuth = smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined;
  return {
    adapter: PostgresAdapter(pool),
    providers: [
      Nodemailer({
        server: {
          host: smtpHost,
          port: Number(smtpPort ?? 587),
          auth: smtpAuth,
        },
        from: smtpFrom,
      }),
    ],
    pages: {
      signIn: "/auth",
      verifyRequest: "/auth/check-email",
    },
    session: {
      strategy: "database",
    },
    callbacks: {
      session({ session, user }) {
        if (session.user) {
          session.user.id = String(user.id);
        }
        return session;
      },
    },
  };
});
