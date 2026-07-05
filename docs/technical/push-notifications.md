# Push Notifications

How Portfolium delivers browser push notifications, independent of email or in-app alerts.

## Overview

Push notifications use the standard [Web Push protocol](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) with VAPID authentication. Implementation is split between `api/app/routers/push.py` (subscription management) and `api/app/services/communications/push_service.py` (sending), with subscriptions stored in `push_subscriptions` (see [Data Models](data-models.md)).

## Subscription Flow

1. The frontend fetches the server's VAPID public key via `GET /push/vapid-public-key`.
2. The browser's Push API generates a subscription (endpoint URL + encryption keys) using that public key.
3. The frontend sends the subscription to `POST /push/subscribe`, which stores the endpoint, `p256dh_key`, and `auth_key`, along with a parsed device name and browser from the user agent string.
4. A user can hold multiple active subscriptions — one per browser/device that opted in.

Unsubscribing (`DELETE /push/unsubscribe`) removes a specific subscription; `GET /push/subscriptions` lists a user's active devices, e.g. for a "manage notification devices" settings view.

## Sending a Push

`push_service.py` encrypts the payload per-subscription using each device's stored `p256dh_key`/`auth_key` (standard Web Push encryption) and delivers it to the subscription's endpoint. A `POST /push/test` endpoint exists to send a test notification to verify a subscription is working end-to-end.

## Failure Handling

Each subscription tracks `failed_count`. Repeated delivery failures (for example, a browser subscription that's been revoked or expired on the client side) increment this counter, which is used to identify and prune dead subscriptions rather than continuing to attempt delivery indefinitely.

## Configuration

VAPID keys are required server-side configuration — without them, push notifications cannot be offered (the public key endpoint has nothing valid to return). See [Configuration](../getting-started/configuration.md) for the relevant environment variables.

## Related

- [Notifications](../user-guide/notifications.md) — user-facing notification types and preferences
- [Data Models](data-models.md) — `push_subscriptions` schema
