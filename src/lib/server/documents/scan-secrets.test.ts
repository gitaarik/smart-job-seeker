import { describe, expect, it } from "vitest";
import { redactSecrets } from "./scan-secrets";

describe("redactSecrets", () => {
  it("leaves ordinary code untouched", () => {
    const code = "export const sum = (a: number, b: number) => a + b;";
    const res = redactSecrets(code);
    expect(res.text).toBe(code);
    expect(res.count).toBe(0);
  });

  it("redacts an AWS access key", () => {
    const res = redactSecrets("const k = 'AKIAIOSFODNN7EXAMPLE';");
    expect(res.text).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(res.text).toContain("[REDACTED:aws-access-key]");
    expect(res.count).toBe(1);
  });

  it("redacts a private key block", () => {
    const pem =
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEabc123\nxyz==\n-----END RSA PRIVATE KEY-----";
    const res = redactSecrets(`key:\n${pem}\n`);
    expect(res.text).not.toContain("MIIEabc123");
    expect(res.text).toContain("[REDACTED:private-key]");
    expect(res.count).toBe(1);
  });

  it("redacts .env-style assignments but keeps the key name", () => {
    const env = 'DATABASE_PASSWORD="s3cr3t-p4ssw0rd-value"\nPORT=3000';
    const res = redactSecrets(env);
    expect(res.text).toContain("DATABASE_PASSWORD=");
    expect(res.text).toContain("[REDACTED]");
    expect(res.text).not.toContain("s3cr3t-p4ssw0rd-value");
    expect(res.text).toContain("PORT=3000"); // non-secret assignment untouched
    expect(res.count).toBe(1);
  });

  it("redacts a github token and a stripe key", () => {
    const res = redactSecrets(
      "gh = ghp_" + "a".repeat(36) + "\nstripe = sk_live_" + "b".repeat(24),
    );
    expect(res.text).toContain("[REDACTED:github-token]");
    expect(res.text).toContain("[REDACTED:stripe-key]");
    expect(res.count).toBe(2);
  });
});
