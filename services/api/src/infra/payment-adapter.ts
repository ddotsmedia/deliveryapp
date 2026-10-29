export type AuthorizeResult = { providerIntentId: string; status: "AUTHORIZED" };

// Provider-agnostic gateway port. Only MockPaymentAdapter is enabled until a gateway is approved.
export interface PaymentAdapter {
  readonly name: string;
  authorize(params: { orderId: string; amountFils: number; idempotencyKey: string }): Promise<AuthorizeResult>;
  voidAuthorization(providerIntentId: string): Promise<void>;
  refund(providerIntentId: string, amountFils: number, idempotencyKey: string): Promise<{ providerRefundId: string }>;
}

export class MockPaymentAdapter implements PaymentAdapter {
  readonly name = "mock";
  async authorize(params: { orderId: string; amountFils: number; idempotencyKey: string }): Promise<AuthorizeResult> {
    return { providerIntentId: `mock_${params.idempotencyKey}`, status: "AUTHORIZED" };
  }
  async voidAuthorization(): Promise<void> {}
  async refund(_providerIntentId: string, _amountFils: number, idempotencyKey: string): Promise<{ providerRefundId: string }> {
    return { providerRefundId: `mock_refund_${idempotencyKey}` };
  }
}

export class CheckoutPaymentAdapter implements PaymentAdapter {
  readonly name = "checkout";
  async authorize(): Promise<AuthorizeResult> {
    throw new Error("NOT_CONFIGURED: Checkout.com adapter requires approved sandbox credentials");
  }
  async voidAuthorization(): Promise<void> {
    throw new Error("NOT_CONFIGURED: Checkout.com adapter requires approved sandbox credentials");
  }
  async refund(): Promise<{ providerRefundId: string }> {
    throw new Error("NOT_CONFIGURED: Checkout.com adapter requires approved sandbox credentials");
  }
}
