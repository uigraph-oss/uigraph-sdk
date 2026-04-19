import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { convertUiGraphToMermaid } from '../index'

const data = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../demo/stripe-payment-uig.json'),
    'utf-8'
  )
)

const { mermaid } = convertUiGraphToMermaid(data, { detailedContext: true })

describe('stripe-payment-uig detailed mermaid', () => {
  it('A — User clicks Pay', () => {
    expect(mermaid).toContain('A["Name: User clicks Pay"]')
  })

  it('B — Create Payment Intent request to backend', () => {
    expect(mermaid).toContain(
      'B["Name: Create Payment Intent request to backend"]'
    )
  })

  it('C — Backend calls Stripe API: Create PaymentIntent', () => {
    expect(mermaid).toContain(
      'C["Cloud: Backend calls Stripe API: Create PaymentIntent"]'
    )
  })

  it('D — Stripe returns client_secret', () => {
    expect(mermaid).toContain('D["Name: Stripe returns client_secret"]')
  })

  it('E — Backend sends client_secret to client', () => {
    expect(mermaid).toContain(
      'E["Name: Backend sends client_secret to client"]'
    )
  })

  it('F — Client confirms payment using Stripe.js / SDK', () => {
    expect(mermaid).toContain(
      'F["Name: Client confirms payment using Stripe.js / SDK"]'
    )
  })

  it('G — Payment requires action?', () => {
    expect(mermaid).toContain('G["Name: Payment requires action?"]')
  })

  it('H — Trigger 3D Secure / Authentication', () => {
    expect(mermaid).toContain('H["Name: Trigger 3D Secure / Authentication"]')
  })

  it('I — Authentication success?', () => {
    expect(mermaid).toContain('I["Name: Authentication success?"]')
  })

  it('J — Payment Failed', () => {
    expect(mermaid).toContain('J["Name: Payment Failed"]')
  })

  it('K — Continue payment confirmation', () => {
    expect(mermaid).toContain('K["Name: Continue payment confirmation"]')
  })

  it('L — Payment outcome', () => {
    expect(mermaid).toContain('L["Name: Payment outcome"]')
  })

  it('M — PaymentIntent status = succeeded', () => {
    expect(mermaid).toContain('M["Name: PaymentIntent status = succeeded"]')
  })

  it('N — PaymentIntent status = processing', () => {
    expect(mermaid).toContain('N["Name: PaymentIntent status = processing"]')
  })

  it('O — PaymentIntent status = requires_payment_method', () => {
    expect(mermaid).toContain(
      'O["Name: PaymentIntent status = requires_payment_method"]'
    )
  })

  it('P — Client receives success response', () => {
    expect(mermaid).toContain('P["Name: Client receives success response"]')
  })

  it('Q — Show success UI', () => {
    expect(mermaid).toContain('Q["Name: Show success UI"]')
  })

  it('R — Wait for webhook confirmation', () => {
    expect(mermaid).toContain('R["Name: Wait for webhook confirmation"]')
  })

  it('S — Client shows error', () => {
    expect(mermaid).toContain('S["Name: Client shows error"]')
  })

  it('T — User retries payment', () => {
    expect(mermaid).toContain('T["Name: User retries payment"]')
  })

  it('U — Stripe sends webhook event', () => {
    expect(mermaid).toContain('U["Name: Stripe sends webhook event"]')
  })

  it('V — Event type', () => {
    expect(mermaid).toContain('V["Name: Event type"]')
  })

  it('W — Mark order as paid (databaseTableSQL)', () => {
    expect(mermaid).toContain(
      'W["DataSource: Mark order as paid\ndb: ecommerce.orders\nservice: UIGraph Adapter"]'
    )
  })

  it('X — Mark order as pending (databaseTableSQL)', () => {
    expect(mermaid).toContain(
      'X["DataSource: Mark order as pending\ndb: ecommerce.orders\nservice: UIGraph Adapter"]'
    )
  })

  it('Y — Mark order as failed (databaseTableSQL)', () => {
    expect(mermaid).toContain(
      'Y["DataSource: Mark order as failed\ndb: ecommerce.orders\nservice: UIGraph Adapter"]'
    )
  })

  it('Z — Handle refund', () => {
    expect(mermaid).toContain('Z["Name: Handle refund"]')
  })

  it('AA — Handle dispute', () => {
    expect(mermaid).toContain('AA["Name: Handle dispute"]')
  })

  it('AB — Network failure before confirmation', () => {
    expect(mermaid).toContain('AB["Name: Network failure before confirmation"]')
  })

  it('AC — Duplicate submission', () => {
    expect(mermaid).toContain('AC["Name: Duplicate submission"]')
  })

  it('AD — User closes browser', () => {
    expect(mermaid).toContain('AD["Name: User closes browser"]')
  })

  it('AE — Webhook delay', () => {
    expect(mermaid).toContain('AE["Name: Webhook delay"]')
  })

  it('AF — Idempotency key prevents duplicates', () => {
    expect(mermaid).toContain('AF["Name: Idempotency key prevents duplicates"]')
  })

  it('AG — End', () => {
    expect(mermaid).toContain('AG["Name: End"]')
  })
})
