export interface OtpSender {
  send(phone: string, code: string): Promise<void>;
}

// Default sender: logs nothing sensitive. Replace with an SMS provider adapter in production.
export class LogOtpSender implements OtpSender {
  async send(): Promise<void> {
    // Intentionally silent: codes must never reach logs.
  }
}

// Test sender that records the last code per phone.
export class CaptureOtpSender implements OtpSender {
  readonly sent = new Map<string, string>();
  async send(phone: string, code: string): Promise<void> {
    this.sent.set(phone, code);
  }
}
