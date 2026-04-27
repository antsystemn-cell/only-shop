/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="mn" dir="ltr">
    <Head />
    <Preview>{siteName} — имэйл хаягаа баталгаажуулна уу</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Имэйлээ баталгаажуулна уу</Heading>
        <Text style={text}>
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          -д бүртгүүлсэнд баярлалаа!
        </Text>
        <Text style={text}>
          Доорх товчийг дарж <strong>{recipient}</strong> хаягаа баталгаажуулна уу.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Имэйл баталгаажуулах
        </Button>
        <Text style={footer}>
          Хэрэв та энэ бүртгэлийг үүсгээгүй бол энэ имэйлийг үл тоомсорлоно уу.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(235, 75%, 4%)', margin: '0 0 20px' }
const text = { fontSize: '15px', color: 'hsl(234, 11%, 35%)', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: 'hsl(243, 95%, 67%)', textDecoration: 'none' }
const button = {
  backgroundColor: 'hsl(243, 95%, 67%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
