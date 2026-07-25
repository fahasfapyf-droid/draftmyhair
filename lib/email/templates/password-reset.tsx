import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface PasswordResetEmailProps {
  name?: string | null;
  resetUrl: string;
}

export function PasswordResetEmail({
  name,
  resetUrl,
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />

      <Preview>
        Reset your Draft My Hair password
      </Preview>

      <Body
        style={{
          backgroundColor: "#f5f5f5",
          fontFamily:
            "Arial, Helvetica, sans-serif",
          padding: "40px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            maxWidth: "600px",
            margin: "0 auto",
            padding: "40px",
          }}
        >
          <Heading
            style={{
              marginTop: 0,
              marginBottom: "24px",
              fontSize: "28px",
            }}
          >
            Reset your password
          </Heading>

          <Text>
            Hi{name ? ` ${name}` : ""},
          </Text>

          <Text>
            We received a request to reset the
            password for your Draft My Hair
            account.
          </Text>

          <Text>
            Click the button below to choose a
            new password.
          </Text>

          <Section
            style={{
              textAlign: "center",
              margin: "36px 0",
            }}
          >
            <Button
              href={resetUrl}
              style={{
                backgroundColor: "#111827",
                color: "#ffffff",
                padding: "14px 28px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: "bold",
                display: "inline-block",
              }}
            >
              Reset Password
            </Button>
          </Section>

          <Text>
            This link will expire in{" "}
            <strong>1 hour</strong>.
          </Text>

          <Text>
            If you didn't request a password
            reset, you can safely ignore this
            email.
          </Text>

          <Hr />

          <Text
            style={{
              color: "#6b7280",
              fontSize: "12px",
            }}
          >
            Draft My Hair
            <br />
            Same Face. New Hair.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}