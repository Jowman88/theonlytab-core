import React, { Suspense } from 'react';
import ProfessionalCheckoutForm from '@/components/ProfessionalCheckoutForm';

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center text-xs text-neutral-500">Loading order gateway configuration...</div>}>
      <ProfessionalCheckoutForm />
    </Suspense>
  );
}
