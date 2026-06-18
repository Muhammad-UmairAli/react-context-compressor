import { describe, expect, it } from "vitest";
import { compress } from "../index";
import { DEFAULT_DENY_LIST, isSensitiveKey, normalizeKey, REDACTED, regexTest } from "./sanitize";

describe("sanitize — built-in deny-list (positive)", () => {
  it.each([
    "password",
    "Password",
    "passwd",
    "passphrase",
    "passwordHash",
    "token",
    "accessToken",
    "refreshToken",
    "authToken",
    "API_KEY",
    "apiKey",
    "accessKey",
    "privateKey",
    "signingKey",
    "encryptionKey",
    "clientSecret",
    "secret",
    "Authorization",
    "bearerToken",
    "jwt",
    "credential",
    "credentials",
    "sessionId",
    "sessionToken",
    "cookie",
    "otp",
    "totp",
    "mfa",
    "mnemonic",
    "seedPhrase",
    "recoveryCode",
    "backupCodes",
    "hmac",
    "signature",
    "csrf",
    "connectionString",
    "dsn",
    "databaseUrl",
    "ssn",
    "creditCard",
    "cardNumber",
    "cvv",
    "pin",
    "iban",
    "routingNumber",
    "accountNumber",
    "passport",
    "taxId",
  ])("redacts sensitive key %s by default", (key) => {
    expect(compress({ [key]: "SENSITIVE" })).toEqual({ [key]: REDACTED });
  });
});

describe("sanitize — built-in deny-list (negative / no false positives)", () => {
  it.each([
    "author",
    "dashboard",
    "passenger",
    "wildcard",
    "cardinality",
    "description",
    "spinning",
    "name",
    "email",
    "count",
    "secretary",
    "accessKeyword",
    "accessKeyboard",
    "tokenCount",
    "tokenize",
    "tokenizer",
    "promptTokens",
    "completionTokens",
    "totalTokens",
    "monkey",
  ])("does NOT redact non-sensitive key %s", (key) => {
    expect(compress({ [key]: "value" })).toEqual({ [key]: "value" });
  });
});

describe("sanitize — no-leak guarantee (matrix)", () => {
  it("never lets a sensitive value reach the output (top-level, nested, in-array)", () => {
    const state = {
      user: {
        name: "alice",
        apiKey: "SECRET-KEY-123",
        profile: { password: "p@ssw0rd" },
      },
      sessions: [{ sessionId: "SID-XYZ", ok: true }],
      authToken: "BEARER-TOK",
      apiKeys: ["k1", "k2"],
    };
    const json = JSON.stringify(compress(state));
    for (const secret of ["SECRET-KEY-123", "p@ssw0rd", "SID-XYZ", "BEARER-TOK", "k1", "k2"]) {
      expect(json).not.toContain(secret);
    }
    expect(json).toContain("alice");
    expect(json).toContain("ok");
  });

  it("never reads a sensitive field's value (getter is not fired)", () => {
    const obj: Record<string, unknown> = { name: "x" };
    Object.defineProperty(obj, "password", {
      enumerable: true,
      get() {
        throw new Error("sensitive value was read!");
      },
    });
    expect(() => compress(obj)).not.toThrow();
    expect(compress(obj)).toEqual({ name: "x", password: REDACTED });
  });

  it("redacts a whole sensitive subtree without descending into it", () => {
    expect(compress({ credentials: { user: "u", pass: "p", deep: { x: 1 } } })).toEqual({
      credentials: REDACTED,
    });
  });

  it("redacts a sensitive key carried by a Map", () => {
    const json = JSON.stringify(compress(new Map([["password", "PWVAL"]])));
    expect(json).not.toContain("PWVAL");
    expect(compress(new Map([["password", "PWVAL"]]))).toEqual({ password: REDACTED });
  });

  it("redacts a sensitive field on a class instance", () => {
    class Account {
      apiKey = "AK-LEAK";
      name = "acme";
    }
    const out = compress(new Account());
    expect(out).toEqual({ apiKey: REDACTED, name: "acme" });
    expect(JSON.stringify(out)).not.toContain("AK-LEAK");
  });
});

describe("sanitize — Unicode / zero-width evasion (F3)", () => {
  it("catches a fullwidth key after NFKC normalization", () => {
    const out = compress({ ｐａｓｓｗｏｒｄ: "FULLWIDTH-SECRET" }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toContain("FULLWIDTH-SECRET");
    expect(Object.values(out)[0]).toBe(REDACTED);
  });

  it("catches a key with an injected zero-width space", () => {
    const key = "pass​word";
    const out = compress({ [key]: "ZW-SECRET" });
    expect(JSON.stringify(out)).not.toContain("ZW-SECRET");
  });
});

describe("sanitize — modes & options", () => {
  it("removes the key entirely in remove mode", () => {
    expect(compress({ password: "x", name: "y" }, { sanitizeMode: "remove" })).toEqual({
      name: "y",
    });
  });

  it("uses a custom redactedValue", () => {
    expect(compress({ token: "x" }, { redactedValue: "***" })).toEqual({ token: "***" });
  });

  it("keeps a redacted key even when redactedValue is empty and dropEmpty is on (A3)", () => {
    // The sanitize branch short-circuits before the dropEmpty check, so a
    // redacted field is never dropped — locking the ordering against regression.
    expect(compress({ secret: "x" }, { redactedValue: "", dropEmpty: true })).toEqual({
      secret: "",
    });
  });

  it("extends the deny-list with user matchers (string is case-insensitive exact)", () => {
    expect(compress({ employeeId: "E1", name: "n" }, { sanitize: ["employeeid"] })).toEqual({
      employeeId: REDACTED,
      name: "n",
    });
  });

  it("supports user RegExp matchers", () => {
    expect(compress({ xField: "x", yField: 2 }, { sanitize: [/^x/] })).toEqual({
      xField: REDACTED,
      yField: 2,
    });
  });

  it("disables built-ins with defaultSanitize:false (only user matchers apply)", () => {
    expect(compress({ password: "p", custom: "c" }, { defaultSanitize: false })).toEqual({
      password: "p",
      custom: "c",
    });
    expect(
      compress({ password: "p", custom: "c" }, { defaultSanitize: false, sanitize: ["custom"] }),
    ).toEqual({ password: "p", custom: REDACTED });
  });
});

describe("sanitize — helpers", () => {
  it("isSensitiveKey honours user matchers and the deny-list toggle", () => {
    expect(isSensitiveKey("password", [], true)).toBe(true);
    expect(isSensitiveKey("password", [], false)).toBe(false);
    expect(isSensitiveKey("Custom", ["custom"], false)).toBe(true);
    expect(isSensitiveKey("nope", [/^x/], true)).toBe(false);
  });

  it("normalizeKey folds fullwidth and strips zero-width chars", () => {
    expect(normalizeKey("ｐａｓｓ")).toBe("pass");
    expect(normalizeKey("pa​ss")).toBe("pass");
  });

  it("regexTest is deterministic for global/sticky patterns", () => {
    const g = /token/gi;
    expect(regexTest(g, "myToken")).toBe(true);
    expect(regexTest(g, "myToken")).toBe(true); // would fail without lastIndex reset
    expect(regexTest(g, "nope")).toBe(false);
  });

  it("ships a non-empty deny-list", () => {
    expect(DEFAULT_DENY_LIST.length).toBeGreaterThan(15);
  });
});
