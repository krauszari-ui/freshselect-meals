import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

import { sendAdminNotification, sendApplicantConfirmation, sendEmail } from "./email";

describe("Resend idempotency options", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_idempotency_key_0123456789";
    process.env.RESEND_FROM_EMAIL = "FreshSelect Meals <admin@freshselectmeals.com>";
    mockSend.mockReset();
    mockSend.mockResolvedValue({ data: { id: "email_123" }, error: null });
  });

  it("passes an SDK idempotency option for generic transactional email", async () => {
    await expect(sendEmail({ to: "recipient@example.invalid", subject: "Test", html: "<p>Test</p>" })).resolves.toBe(true);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "recipient@example.invalid" }),
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^generic-/) }),
    );
  });

  it("uses a caller-provided stable idempotency key for scheduled messages", async () => {
    await expect(sendEmail({
      to: "recipient@example.invalid",
      subject: "Daily report",
      html: "<p>Test</p>",
      idempotencyKey: "daily-digest-2026-10-13",
    })).resolves.toBe(true);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "recipient@example.invalid" }),
      { idempotencyKey: "daily-digest-2026-10-13" },
    );
  });

  it("uses stable idempotency keys for application confirmation and internal alert", async () => {
    const data = {
      referenceNumber: "FSM-TEST123456",
      firstName: "Test",
      lastName: "Applicant",
      email: "applicant@example.invalid",
      cellPhone: "555-555-5555",
      medicaidId: "AB12345C",
      supermarket: "Foodoo",
      formData: {},
    };

    await expect(sendApplicantConfirmation(data)).resolves.toBe(true);
    await expect(sendAdminNotification(data)).resolves.toBe(true);

    expect(mockSend).toHaveBeenNthCalledWith(1, expect.any(Object), { idempotencyKey: "applicant-FSM-TEST123456" });
    expect(mockSend).toHaveBeenNthCalledWith(2, expect.any(Object), { idempotencyKey: "admin-FSM-TEST123456" });
  });
});
