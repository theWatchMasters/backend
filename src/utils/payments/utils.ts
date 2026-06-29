import type Stripe from 'stripe';
import { stripe } from './client.js';

const USD_TO_CENTS = 100;
export function createPaymentIntent(
  amount: number,
): Promise<{ id: string; client_secret: string }> {
  return stripe.paymentIntents
    .create({
      amount: Math.round(amount * USD_TO_CENTS),
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      capture_method: 'manual',
    })
    .then((paymentIntent) => ({
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret!,
    }));
}

export function isPaymentIntentSuccessful(id: string): Promise<boolean> {
  return stripe.paymentIntents.retrieve(id).then((paymentIntent) => {
    return paymentIntent.status === 'requires_capture';
  });
}

export function capturePayment(id: string): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.capture(id);
}

export function cancelPayment(id: string): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.cancel(id);
}
