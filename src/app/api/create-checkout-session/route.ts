import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe('sk_test_51U5mSkEKVRr0yl1YGpRXE6Ql3aosswTULn7BLa0h85xooxpIiAU0gC4s2ECFF7vSdagCn0DsIuegBZzoKmtqqmee006jJvgLbo', { apiVersion: '2023-10-16' }); // Zorg dat hier je SK_TEST sleutel staat!

export async function POST(request: Request) {
  try {
    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: { 
          currency: 'usd', 
          product_data: { name: "The Only Tab - Premium Space" }, 
          unit_amount: 100 
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: 'https://theonlytab.io',
      cancel_url: 'https://theonlytab.io'
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: `SERVER_CRASH: ${err.message}` }, { status: 500 });
  }
}
