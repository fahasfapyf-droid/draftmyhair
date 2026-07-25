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

interface VerifyEmailProps {
  name?: string | null;
  verificationUrl: string;
}

export default function VerifyEmail({
  name,
  verificationUrl,
}: VerifyEmailProps) {
  return (
    <Html>
      <Head />

      <Preview>
        Verify your Draft My Hair email address
      </Preview>

      <Body
        style={{
          backgroundColor: "#f6f6f6",
          fontFamily:
            "Arial, Helvetica, sans-serif",
        }}
      >
        <Container
          style={{
            maxWidth: "600px",
            margin: "40px auto",
            backgroundColor: "#ffffff",
            padding: "40px",
            borderRadius: "8px",
          }}
        >
          <Heading>
            Verify your email
          </Heading>

          <Text>
            Hello {name ?? "there"},
          </Text>

          <Text>
            Thank you for creating your Draft My Hair
            account.
          </Text>

          <Text>
            Please verify your email address by
            clicking the button below.
          </Text>

          <Section
            style={{
              textAlign: "center",
              margin: "32px 0",
            }}
          >
            <Button
              href={verificationUrl}
              style={{
                backgroundColor: "#111827",
                color: "#ffffff",
                padding: "14px 24px",
                borderRadius: "6px",
                textDecoration: "none",
              }}
            >
              Verify Email
            </Button>
          </Section>

          <Text>
            If the button does not work, copy and
            paste this link into your browser:
          </Text>

          <Text>{verificationUrl}</Text>

          <Hr />

          <Text
            style={{
              color: "#666",
              fontSize: "12px",
            }}
          >
            If you did not create this account,
            you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}