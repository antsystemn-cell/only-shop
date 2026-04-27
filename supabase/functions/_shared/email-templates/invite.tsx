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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="mn" dir="ltr">
    <Head />
    <Preview>{siteName}-д таныг урьж байна</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Таныг урьж байна</Heading>
        <Text style={text}>
          Таныг{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          -д нэгдэхэд урьж байна. Доорх товчийг дарж урилгыг хүлээн авч бүртгэл үүсгэнэ үү.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Урилга хүлээн авах
        </Button>
        <Text style={footer}>
          Хэрэв та энэ урилгыг хүлээж байгаагүй бол энэ имэйлийг үл тоомсорлоно уу.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
