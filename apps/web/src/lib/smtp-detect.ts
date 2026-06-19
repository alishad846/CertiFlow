export type SmtpPreset = {
  provider: string;
  port: number;
  secure: boolean;
  note: string;
};

function matchesHost(host: string, patterns: string[]) {
  return patterns.some((pattern) => host.includes(pattern));
}

export function inferSmtpPreset(hostInput: string): SmtpPreset | null {
  const host = hostInput.trim().toLowerCase();
  if (!host) {
    return null;
  }

  if (matchesHost(host, ['gmail.com', 'googlemail.com'])) {
    return {
      provider: 'Gmail / Google Workspace',
      port: 587,
      secure: false,
      note: 'Use port 587 with STARTTLS for Gmail or Google Workspace.'
    };
  }

  if (matchesHost(host, ['outlook.com', 'hotmail.com', 'live.com', 'office365.com', 'microsoft.com'])) {
    return {
      provider: 'Outlook / Microsoft 365',
      port: 587,
      secure: false,
      note: 'Use port 587 with STARTTLS for Outlook or Microsoft 365.'
    };
  }

  if (matchesHost(host, ['zoho.com'])) {
    return {
      provider: 'Zoho Mail',
      port: 587,
      secure: false,
      note: 'Zoho usually works with port 587 and STARTTLS.'
    };
  }

  if (matchesHost(host, ['yahoo.com'])) {
    return {
      provider: 'Yahoo Mail',
      port: 465,
      secure: true,
      note: 'Yahoo commonly uses port 465 with SSL/TLS.'
    };
  }

  if (matchesHost(host, ['mail.', 'smtp.', 'mx.'])) {
    return {
      provider: 'Custom mail host',
      port: 587,
      secure: false,
      note: 'Custom SMTP hosts usually start with port 587 and STARTTLS.'
    };
  }

  return {
    provider: 'SMTP server',
    port: 587,
    secure: false,
    note: 'Defaulting to port 587 with STARTTLS. Adjust it if your provider needs SSL on 465.'
  };
}
