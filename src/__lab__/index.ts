import stripePaymentJson from '../../demo/stripe-payment-uig.json'
import { convertUiGraphToMermaid, UiGraphInput } from '../uig-converter'

console.log(
  convertUiGraphToMermaid(stripePaymentJson as UiGraphInput, {
    detailedContext: true,
  }).mermaid
)
