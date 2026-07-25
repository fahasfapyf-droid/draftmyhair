import { ReactElement } from "react";

import { resend } from "./resend";

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ??
  "Draft My Hair <onboarding@resend.dev>";

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
  const { data, error } =
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      react,
    });

  if (error) {
    console.error(error);

    throw new Error(
      "Unable to send email."
    );
  }

  return data;
}