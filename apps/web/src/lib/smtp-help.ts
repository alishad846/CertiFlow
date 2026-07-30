export type SmtpHelp = {
  title: string;
  description: string;
  fixes: string[];
};

export function getSmtpHelp(message: string): SmtpHelp | null {
  const lower = message.toLowerCase();

  if (lower.includes('port 587') && lower.includes('secure')) {
    return {
      title: 'Port 587 uses STARTTLS',
      description: 'This SMTP server expects a plain connection that upgrades to TLS. Keep SMTP secure turned off for port 587.',
      fixes: ['Set SMTP port to 587', 'Turn off SMTP secure', 'Save the sender and click Test SMTP again']
    };
  }

  if (lower.includes('port 465') && lower.includes('secure')) {
    return {
      title: 'Port 465 needs SSL/TLS',
      description: 'Port 465 is the implicit SSL/TLS mode. It should be used with SMTP secure turned on.',
      fixes: ['Set SMTP port to 465', 'Turn on SMTP secure', 'Save the sender and test again']
    };
  }

  if (lower.includes('self-signed certificate') || lower.includes('untrusted')) {
    return {
      title: 'SMTP certificate is not trusted',
      description: 'Your SMTP server is presenting a self signed or internally issued certificate.',
      fixes: ['Turn on Allow invalid certs for this company', 'Or install a trusted certificate on the SMTP server', 'Test SMTP again after saving']
    };
  }

  if (lower.includes('invalid username or password') || lower.includes('incorrect authentication data') || lower.includes('535')) {
    return {
      title: 'SMTP login failed',
      description: 'The server rejected the username or password you saved.',
      fixes: ['Type the SMTP username again exactly as provided by your mail host', 'Use the mailbox password or app password', 'Save the sender and click Test SMTP']
    };
  }

  if (lower.includes('not configured for this company')) {
    return {
      title: 'Sender is not configured yet',
      description: 'This company does not have an email sender saved in the database.',
      fixes: ['Open the Sender page', 'Fill SMTP host, username, password, and sender email', 'Click Save sender and then Test SMTP']
    };
  }

  if (lower.includes('disabled for this company')) {
    return {
      title: 'Sender is disabled',
      description: 'The sender settings exist, but sending is turned off for this company.',
      fixes: ['Open the Sender page', 'Turn on Sender enabled', 'Save the sender and try again']
    };
  }

  if (lower.includes('could not connect') || lower.includes('connect') || lower.includes('econnrefused')) {
    return {
      title: 'Cannot reach the SMTP server',
      description: 'The app could not connect to the SMTP host from this machine.',
      fixes: ['Check the SMTP host name', 'Confirm the port is open on your mail server', 'Make sure the server allows connections from this app']
    };
  }

  return null;
}
