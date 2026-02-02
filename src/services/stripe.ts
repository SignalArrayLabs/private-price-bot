/**
 * Stripe Payment Integration Service
 *
 * NOTE: Stripe integration is pending. This service provides the structure
 * for future implementation. Currently, only manual approval is functional.
 *
 * To enable Stripe payments:
 * 1. Set STRIPE_SECRET_KEY in .env
 * 2. Set STRIPE_WEBHOOK_SECRET in .env
 * 3. Set STRIPE_PRICE_ID in .env
 * 4. Set BOT_URL in .env (for webhook endpoint)
 * 5. Enable crypto payments in Stripe Dashboard (one click)
 */

import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import {
  createPaymentTransaction as _createPaymentTransaction,
  updatePaymentTransaction,
  getPaymentTransaction as _getPaymentTransaction,
  authorizeUser,
} from '../db/index.js';

// Re-export for future use (suppresses unused warnings)
export const createPaymentTransaction = _createPaymentTransaction;
export const getPaymentTransaction = _getPaymentTransaction;

// Stripe will be imported dynamically when available
let stripe: any = null;

/**
 * Initialize Stripe client if configured
 */
export function initStripe(): boolean {
  if (!config.stripeSecretKey) {
    logger.info('Stripe not configured - payment integration disabled');
    return false;
  }

  try {
    // Dynamic import would go here when Stripe is added as dependency
    // import Stripe from 'stripe';
    // stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2023-10-16' });
    logger.warn('Stripe SDK not installed - payment integration pending');
    return false;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Stripe');
    return false;
  }
}

/**
 * Check if Stripe is available and configured
 */
export function isStripeEnabled(): boolean {
  return stripe !== null && config.stripeSecretKey !== undefined;
}

/**
 * Create a Stripe Checkout session for a user
 *
 * @param tgUserId - Telegram user ID
 * @param username - Optional username for reference
 * @returns Checkout session URL or null if Stripe not configured
 */
export async function createCheckoutSession(
  tgUserId: number,
  _username?: string
): Promise<string | null> {
  if (!isStripeEnabled()) {
    logger.warn('Attempted to create checkout session but Stripe is not enabled');
    return null;
  }

  if (!config.stripePriceId) {
    logger.error('STRIPE_PRICE_ID not configured');
    return null;
  }

  if (!config.botUrl) {
    logger.error('BOT_URL not configured for Stripe redirect');
    return null;
  }

  try {
    // This would create a Stripe checkout session
    // const session = await stripe.checkout.sessions.create({
    //   payment_method_types: ['card'],
    //   // Crypto is automatically enabled if you enable it in Stripe Dashboard
    //   line_items: [
    //     {
    //       price: config.stripePriceId,
    //       quantity: 1,
    //     },
    //   ],
    //   mode: 'payment',
    //   success_url: `${config.botUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    //   cancel_url: `${config.botUrl}/payment/cancel`,
    //   metadata: {
    //     tg_user_id: tgUserId.toString(),
    //     tg_username: username || '',
    //   },
    //   expires_at: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    // });

    // Create payment transaction record
    // createPaymentTransaction(tgUserId, session.id, config.subscriptionPrice);

    // return session.url;

    logger.info({ tgUserId }, 'Checkout session creation attempted (Stripe pending)');
    return null;
  } catch (error) {
    logger.error({ error, tgUserId }, 'Failed to create checkout session');
    return null;
  }
}

/**
 * Handle Stripe webhook event
 *
 * @param payload - Raw request body
 * @param signature - Stripe signature header
 * @returns true if handled successfully
 */
export async function handleWebhook(
  _payload: string | Buffer,
  _signature: string
): Promise<boolean> {
  if (!isStripeEnabled() || !config.stripeWebhookSecret) {
    logger.warn('Webhook received but Stripe not configured');
    return false;
  }

  try {
    // Verify webhook signature
    // const event = stripe.webhooks.constructEvent(
    //   payload,
    //   signature,
    //   config.stripeWebhookSecret
    // );

    // switch (event.type) {
    //   case 'checkout.session.completed':
    //     await handleCheckoutCompleted(event.data.object);
    //     break;
    //   case 'checkout.session.expired':
    //     await handleCheckoutExpired(event.data.object);
    //     break;
    //   default:
    //     logger.debug({ type: event.type }, 'Unhandled webhook event');
    // }

    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to handle webhook');
    return false;
  }
}

/**
 * Handle successful checkout completion
 * @internal Exported for future webhook integration
 */
export async function handleCheckoutCompleted(session: any): Promise<void> {
  const tgUserId = parseInt(session.metadata?.tg_user_id, 10);
  const username = session.metadata?.tg_username;

  if (!tgUserId) {
    logger.error({ sessionId: session.id }, 'No user ID in session metadata');
    return;
  }

  // Determine payment method
  let paymentMethod = 'card';
  if (session.payment_method_types?.includes('crypto')) {
    // Check if crypto was actually used
    // const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
    // paymentMethod = paymentIntent.payment_method_types[0] === 'crypto' ? 'crypto' : 'card';
  }

  const authorizationType = paymentMethod === 'crypto' ? 'stripe_crypto' : 'stripe_card';

  // Update payment transaction
  updatePaymentTransaction(session.id, 'completed', {
    stripePaymentIntentId: session.payment_intent,
    paymentMethod,
  });

  // Authorize user
  authorizeUser(tgUserId, authorizationType, {
    username,
    stripePaymentId: session.payment_intent,
    amountPaid: session.amount_total ? session.amount_total / 100 : config.subscriptionPrice,
  });

  logger.info({ tgUserId, paymentMethod, sessionId: session.id }, 'User authorized via Stripe payment');
}

/**
 * Handle expired checkout session
 * @internal Exported for future webhook integration
 */
export async function handleCheckoutExpired(session: any): Promise<void> {
  updatePaymentTransaction(session.id, 'expired');
  logger.info({ sessionId: session.id }, 'Checkout session expired');
}

/**
 * Get payment link for a user
 * Returns existing pending session or creates new one
 */
export async function getPaymentLink(
  tgUserId: number,
  username?: string
): Promise<string | null> {
  // For now, return null since Stripe is not implemented
  // In the future, this would check for existing pending sessions
  // and create a new one if needed

  return createCheckoutSession(tgUserId, username);
}
