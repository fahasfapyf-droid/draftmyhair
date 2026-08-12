import { ReactElement } from "react";

import { getResendClient } from "./resend";

export interface SendEmailOptions {
  to: string;
  subject: string;
  react: ReactElement;
}

export async function sendEmail({
  to,
  subject,
  react,
}: SendEmailOptions) {
  const resend = getResendClient();
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!fromEmail) {
    throw new Error("Missing RESEND_FROM_EMAIL environment variable.");
  }

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    react,
  });

  if (error) {
    console.error(error);

    throw new Error("Unable to send email.");
  }

  return data;
}
