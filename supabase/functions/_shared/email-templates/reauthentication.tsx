/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="mn" dir="ltr">
    <Head />
    <Preview>Таны баталгаажуулах код</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Дахин баталгаажуулалт</Heading>
        <Text style={text}>Доорх кодыг ашиглан өөрийгөө баталгаажуулна уу:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Энэ код удахгүй хүчингүй болно. Хэрэв та энэ хүсэлтийг илгээгээгүй бол энэ имэйлийг үл тоомсорлоно уу.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(235, 75%, 4%)', margin: '0 0 20px' }
const text = { fontSize: '15px', color: 'hsl(234, 11%, 35%)', lineHeight: '1.6', margin: '0 0 20px' }
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: 'hsl(243, 95%, 67%)',
  letterSpacing: '4px',
  margin: '0 0 30px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
