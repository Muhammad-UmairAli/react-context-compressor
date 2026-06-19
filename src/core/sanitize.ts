/**
 * Client-side data-safety layer — detect sensitive field names so the walker
 * can redact or remove them BEFORE their values are ever read. Mechanical and
 * key-name-driven: no value inspection, no network, no models.
 *
 * Limitations (key-name-driven by design):
 *  - Matches field NAMES, not values: a secret under an innocuous key, or as a
 *    bare array/Set element (no key), is NOT detected. In particular an
 *    `Error.message` or `RegExp` source is emitted as a string value (only
 *    redacted by its KEY) — don't store secrets in error messages under a
 *    non-sensitive key.
 *  - Only own enumerable string keys are processed; Symbol-keyed / non-enumerable
 *    properties are dropped by the walker, never scanned.
 *  - Homoglyph attacks (e.g. Cyrillic look-alikes) are not fully closed; keys are
 *    NFKC-normalized and zero-width-stripped before matching, which defeats the
 *    common fullwidth/zero-width evasions but not deliberate confusables.
 */

/** Default replacement value used when a sensitive field is redacted. */
export const REDACTED = "[REDACTED]";

/**
 * Built-in deny-list of sensitive field-name patterns (case-insensitive).
 * Patterns are anchored to avoid false positives on common keys — e.g. it does
 * NOT redact `author`, `dashboard`, `secretary`, `tokenCount`, `promptTokens`,
 * or `accessKeyboard`.
 */
export const DEFAULT_DENY_LIST: readonly RegExp[] = [
  // Passwords / pass-phrases
  /pass(?:word|wd|phrase)/i,
  // Secrets ("secret", "clientSecret", "secretKey") but not "secretary"
  /secret(?!ary)/i,
  // Tokens — standalone or with an auth-ish prefix; NOT tokenCount/tokenize/promptTokens
  /\btoken\b/i,
  /(?:access|refresh|id|auth|bearer|api|csrf|xsrf|session|sso|oauth|reset|verification|activation)[-_]?token/i,
  // Keys ("apiKey", "accessKey", "signingKey") but not "accessKeyword"/"keyboard"
  /(?:api|access|private|signing|encryption)[-_]?keys?(?![a-z])/i,
  /\bjwt\b/i,
  /authorization/i,
  /bearer/i,
  /credentials?/i,
  /cookie/i,
  /session[-_]?(?:id|token|key)/i,
  // 2FA / recovery
  /\b(?:otp|totp|mfa|2fa)\b/i,
  /(?:recovery|backup)[-_]?codes?/i,
  /\bmnemonic\b/i,
  /seed[-_]?phrase/i,
  // Crypto / signing
  /\bhmac\b/i,
  /\bsignature\b/i,
  /\b[cx]srf\b/i,
  // Connection strings / DB credentials
  /connection[-_]?string/i,
  /\bdsn\b/i,
  /(?:database|db)[-_]?(?:url|uri)/i,
  // PII / financial
  /ssn/i,
  /social[-_]?security[-_]?(?:number|no)?/i,
  /credit[-_]?card/i,
  /card[-_]?number/i,
  /cvv2?/i,
  /\bpin\b/i,
  /\biban\b/i,
  /routing[-_]?number/i,
  /account[-_]?number/i,
  /\bpassport\b/i,
  /tax[-_]?id/i,
];

/** Zero-width / default-ignorable code points used to evade name matching. */
const ZERO_WIDTH = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;

/**
 * Normalize a key before matching: NFKC folds fullwidth/compatibility forms to
 * their ASCII equivalents, and zero-width characters are stripped. This defeats
 * the common `"ｐａｓｓｗｏｒｄ"` / zero-width-injected evasions.
 */
export function normalizeKey(key: string): string {
  return key.normalize("NFKC").replace(ZERO_WIDTH, "");
}

/**
 * Stateless RegExp test. A user-supplied pattern with the `g`/`y` flag carries
 * a mutable `lastIndex`; resetting it keeps matching deterministic across keys.
 */
export function regexTest(re: RegExp, value: string): boolean {
  if (re.global || re.sticky) re.lastIndex = 0;
  return re.test(value);
}

/**
 * Is `key` a sensitive field name? Checks user matchers (string = exact,
 * case-insensitive; RegExp = pattern) and, when `useDefaults`, the built-in
 * deny-list. Keys are NFKC-normalized and zero-width-stripped first.
 */
export function isSensitiveKey(
  key: string,
  userMatchers: ReadonlyArray<string | RegExp>,
  useDefaults: boolean,
): boolean {
  const normalized = normalizeKey(key);
  const lower = normalized.toLowerCase();
  for (const matcher of userMatchers) {
    if (typeof matcher === "string") {
      if (normalizeKey(matcher).toLowerCase() === lower) return true;
    } else if (regexTest(matcher, normalized)) {
      return true;
    }
  }
  if (useDefaults) {
    for (const re of DEFAULT_DENY_LIST) {
      if (regexTest(re, normalized)) return true;
    }
  }
  return false;
}
