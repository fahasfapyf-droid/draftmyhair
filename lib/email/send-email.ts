import type { ReactElement } from "react";

import { getResendClient } from "./resend";

interface SendEmailOptions {
  to: string;
  subject: string;
  react: ReactElement;
}

const DEFAULT_FROM =
  process.env.RESEND_FROM_EMAIL ??
  "Draft My Hair <noreply@draftmyhair.com>";

export async function sendEmail({
  to,
  subject,
  react,
}: SendEmailOptions) {
  const resend = getResendClient();

  const { error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to,
    subject,
    react,
  });

  if (error) {
    throw new Error(error.message);
  }
}