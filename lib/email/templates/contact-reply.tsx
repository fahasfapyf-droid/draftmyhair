import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface ContactReplyProps {
  name: string;
  originalSubject: string;
  reply: string;
}

export default function ContactReply({
  name,
  originalSubject,
  reply,
}: ContactReplyProps) {
  return (
    <Html>
      <Head />
      <Preview>Reply from Draft My Hair</Preview>
      <Body style={{ backgroundColor: "#f5f5f5", fontFamily: "Arial, Helvetica, sans-serif", padding: "40px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: "8px", maxWidth: "600px", margin: "0 auto", padding: "40px" }}>
          <Heading style={{ marginTop: 0, marginBottom: "24px" }}>Draft My Hair</Heading>
          <Text>Hello {name},</Text>
          <Text style={{ whiteSpace: "pre-wrap", lineHeight: "1.6" }}>{reply}</Text>
          <Hr />
          <Text style={{ color: "#6b7280", fontSize: "12px" }}>
            Re: {originalSubject}
            <br />
            Draft My Hair
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
