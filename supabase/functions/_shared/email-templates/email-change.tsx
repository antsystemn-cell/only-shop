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

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="mn" dir="ltr">
    <Head />
    <Preview>{siteName} — имэйл хаяг өөрчлөх баталгаажуулалт</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Имэйл хаяг өөрчлөх</Heading>
        <Text style={text}>
          Та {siteName} дээрх имэйл хаягаа{' '}
          <Link href={`mailto:${email}`} style={link}>
            {email}
          </Link>{' '}
          -ээс{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>{' '}
          руу солих хүсэлт илгээсэн байна.
        </Text>
        <Text style={text}>Өөрчлөлтийг баталгаажуулахын тулд доорх товчийг дарна уу:</Text>
        <Button style={button} href={confirmationUrl}>
          Өөрчлөлтийг баталгаажуулах
        </Button>
        <Text style={footer}>
          Хэрэв та энэ хүсэлтийг илгээгээгүй бол бүртгэлийнхээ аюулгүй байдлыг яаралтай шалгана уу.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
