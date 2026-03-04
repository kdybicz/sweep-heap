const parseSmtpPort = (value: string | undefined) => {
  const parsed = Number(value ?? "587");
  return Number.isFinite(parsed) ? parsed : 587;
};

const parseBooleanEnv = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
};

const normalizeEnvValue = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export type SmtpSettings = {
  host: string | undefined;
  from: string | undefined;
  port: number;
  secure: boolean;
  auth:
    | {
        user: string;
        pass: string;
      }
    | undefined;
};

export const getSmtpSettings = (): SmtpSettings => {
  const host = normalizeEnvValue(process.env.SMTP_HOST);
  const from = normalizeEnvValue(process.env.SMTP_FROM);
  const port = parseSmtpPort(process.env.SMTP_PORT);
  const secureOverride = parseBooleanEnv(process.env.SMTP_SECURE);
  const secure = secureOverride ?? port === 465;

  const user = normalizeEnvValue(process.env.SMTP_USER);
  const pass = normalizeEnvValue(process.env.SMTP_PASS);
  const auth = user && pass ? { user, pass } : undefined;

  return {
    host,
    from,
    port,
    secure,
    auth,
  };
};
