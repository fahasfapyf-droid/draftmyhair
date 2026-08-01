import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface ContactNotificationProps {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export default function ContactNotification({
  name,
  email,
  subject,
  message,
}: ContactNotificationProps) {
  return (
    <Html>
      <Head />

      <Preview>
        New contact enquiry received
      </Preview>

      <Body
        style={{
          backgroundColor: "#f5f5f5",
          fontFamily: "Arial, Helvetica, sans-serif",
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
            }}
          >
            New Contact Enquiry
          </Heading>

          <Text>
            A new contact enquiry has been submitted through the Draft My Hair
            website.
          </Text>

          <Hr />

          <Section>
            <Text>
              <strong>Name</strong>
              <br />
              {name}
            </Text>

            <Text>
              <strong>Email</strong>
              <br />
              {email}
            </Text>

            <Text>
              <strong>Subject</strong>
              <br />
              {subject}
            </Text>

            <Text>
              <strong>Message</strong>
            </Text>

            <Text>{message}</Text>
          </Section>

          <Hr />

          <Text
            style={{
              color: "#6b7280",
              fontSize: "12px",
            }}
          >
            Draft My Hair
            <br />
            Contact Notification
          </Text>
        </Container>
      </Body>
    </Html>
  );
}