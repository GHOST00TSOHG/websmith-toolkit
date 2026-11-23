---
name: payments-test-mode
description: >-
  Use this when taking payments in Stripe test mode with Stripe-hosted
  Checkout: webhooks, signatures, idempotency, delayed payment methods,
  refunds, and rehearsal with the Stripe CLI.
---
# Payments in test mode

A checklist for taking test-mode Stripe payments safely, without ever handling card numbers.

Use **Stripe-hosted Checkout only**, and **test keys only**, until the owner explicitly OKs live keys. Never collect, store, or log card numbers.

## Webhooks and signatures

Fulfill from the webhook, not from the success page. Verify the signature against the **raw request body** (`await request.text()` on Workers). Signing secrets differ per endpoint and between test and live. Default tolerance is 5 minutes. Ignore `v0` signatures. During a secret roll, accept the event if any `v1` signature matches.

`constructEventAsync` and `Stripe.createSubtleCryptoProvider` for Workers were **not found on docs.stripe.com**. Treat them as unconfirmed there; check the [stripe-node README](https://github.com/stripe/stripe-node) before using them. Official Node examples on the Stripe docs use synchronous `constructEvent`.

Docs: [Stripe webhooks](https://docs.stripe.com/webhooks) (Stripe docs).

## Fulfillment

Delayed methods such as ACH end in `checkout.session.async_payment_succeeded` or `checkout.session.async_payment_failed`. Fulfill on both `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Handle `async_payment_failed` (do not mark the order paid). Gate fulfillment on `payment_status` (Checkout lists `paid`, `unpaid`, and `no_payment_required`; Stripe's sample allows anything other than `unpaid`). The fulfill function must be safe to call more than once.

Docs: [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment) (Stripe docs).

## Idempotency

Log processed `event.id` values in a table with a **unique constraint**, and check it before any side effects. Also guard on `data.object` id plus `event.type`, because some duplicates arrive as two separate Event objects.

Retries: live, up to 3 days; sandbox, 3 times over a few hours. Resend: Dashboard for 15 days, Stripe CLI for 30 days.

## Metadata

`session.metadata` is **not copied** to the PaymentIntent. If later PaymentIntent events need the same fields, set them with `payment_intent_data.metadata` when you create the Checkout Session. On `checkout.session.completed`, read `session.metadata`.

## Refunds

Listen for `refund.created` at minimum, plus `refund.updated`, `refund.failed`, and `charge.refunded`. `charge.refund.updated` is deprecated in favor of `refund.updated`. Refund statuses include `pending`, `requires_action`, `succeeded`, `failed`, and `canceled`. Store refund status on the order and update it from `refund.updated`.

Docs: [Refunds](https://docs.stripe.com/refunds) (Stripe docs).

## Rehearse with the Stripe CLI

- `stripe trigger` creates test objects and sends the event to whatever listener or endpoint is configured. It has no endpoint flag. It supports `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `charge.refunded`.
- `stripe events resend <evt_id> --webhook-endpoint=we_...` replays a real event to a specific endpoint. Without that flag it goes to the local `stripe listen` session. CLI resend covers the last 30 days.

Confirm that a second `resend` of the same event is a no-op because of the event-id table.

Docs: [events resend](https://docs.stripe.com/cli/events/resend) and [trigger](https://docs.stripe.com/cli/trigger) (Stripe docs).

## Don't

- Use live keys, or switch out of hosted Checkout, without the owner's explicit OK.
- Parse the body as JSON before verifying the signature.
- Mark an order paid from the success page or from `async_payment_failed`.
- Assume Checkout Session metadata appears on the PaymentIntent.
