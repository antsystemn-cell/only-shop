/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="mn" dir="ltr">
    <Head />
    <Preview>{siteName}-руу нэвтрэх линк</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Нэвтрэх линк</Heading>
        <Text style={text}>
          {siteName}-руу нэвтрэхийн тулд доорх товчийг дарна уу. Энэ линк удахгүй хүчингүй болно.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Нэвтрэх
        </Button>
        <Text style={footer}>
          Хэрэв та энэ линкийг хүсээгүй бол энэ имэйлийг үл тоомсорлоно уу.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(235, 75%, 4%)', margin: '0 0 20px' }
const text = { fontSize: '15px', color: 'hsl(234, 11%, 35%)', lineHeight: '1.6', margin: '0 0 20px' }
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
