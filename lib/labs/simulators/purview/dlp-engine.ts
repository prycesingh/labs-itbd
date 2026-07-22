import type { PurviewDlpPolicy } from "./types";

export type DlpMatch = { type: string; value: string; index: number };
export type DlpRuleMatchResult = { ruleName: string; severity: string; matches: DlpMatch[] };

/**
 * Regex bank for the DLP content-matcher engine. Keys are keyword categories
 * matched heuristically against a rule's free-text `conditions` string (e.g. a
 * condition mentioning "SSN" runs the ssn regex, "Credit Card" runs the
 * creditCard regex, etc.) — this is the DLP page's flagship "paste sample content"
 * tester, replacing source's non-functional canned rule descriptions with real
 * regex matching against actual input text.
 */
const REGEX_BANK: { category: string; keywords: string[]; label: string; pattern: RegExp }[] = [
  { category: "ssn", keywords: ["ssn", "social security"], label: "U.S. Social Security Number (SSN)", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    category: "creditCard",
    keywords: ["credit card", "card number", "pci"],
    label: "Credit Card Number",
    // Visa / MasterCard / Amex / Discover, with optional spaces or dashes as separators.
    pattern: /\b(?:4[0-9]{3}|5[1-5][0-9]{2}|3[47][0-9]{2}|6(?:011|5[0-9]{2}))[- ]?[0-9]{4}[- ]?[0-9]{2,4}[- ]?[0-9]{0,4}\b/g,
  },
  { category: "pan", keywords: ["pan", "permanent account number", "india pan"], label: "India Permanent Account Number (PAN)", pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { category: "aadhaar", keywords: ["aadhaar", "aadhar", "unique identification"], label: "India Unique Identification (Aadhaar) Number", pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/g },
  { category: "awsKey", keywords: ["aws access key", "aws key", "aws"], label: "AWS Access Key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { category: "email", keywords: ["email"], label: "Email Address", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { category: "iban", keywords: ["iban", "international banking"], label: "International Banking Account Number (IBAN)", pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g },
  { category: "dln", keywords: ["dln", "driver license", "driver's license"], label: "Driver License Number", pattern: /\b[A-Z]{1,2}\d{6,8}\b/g },
  { category: "phone", keywords: ["phone"], label: "Phone Number", pattern: /\b\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { category: "sourceCode", keywords: ["source code"], label: "Source code", pattern: /\b(function|def|class|import|public\s+static|#include)\b/g },
];

/** Luhn checksum — used to filter credit-card-shaped matches down to plausible real numbers. */
function passesLuhn(digitsOnly: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digitsOnly.length - 1; i >= 0; i--) {
    let n = parseInt(digitsOnly[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Picks the best-matching regex-bank category for a rule's free-text `conditions` string. */
function findCategoryForConditions(conditions: string): (typeof REGEX_BANK)[number] | null {
  const lower = conditions.toLowerCase();
  for (const entry of REGEX_BANK) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry;
  }
  return null;
}

/**
 * Scans `text` against a single DLP policy's rules, running each rule's matched
 * regex-bank category over the real input and returning genuine match objects
 * (actual substrings + index positions) — not fake counts.
 */
export function scanContentAgainstPolicy(text: string, policy: PurviewDlpPolicy): DlpRuleMatchResult[] {
  const results: DlpRuleMatchResult[] = [];

  for (const rule of policy.rules) {
    const entry = findCategoryForConditions(rule.conditions);
    if (!entry) {
      results.push({ ruleName: rule.name, severity: rule.severity, matches: [] });
      continue;
    }

    const matches: DlpMatch[] = [];
    // Reset lastIndex since the bank's regexes are shared `g`-flag objects.
    entry.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = entry.pattern.exec(text)) !== null) {
      const value = m[0];
      if (entry.category === "creditCard") {
        const digitsOnly = value.replace(/[^0-9]/g, "");
        if (digitsOnly.length < 13 || digitsOnly.length > 19 || !passesLuhn(digitsOnly)) {
          if (entry.pattern.lastIndex === m.index) entry.pattern.lastIndex++;
          continue;
        }
      }
      matches.push({ type: entry.label, value, index: m.index });
      // Guard against zero-length matches causing an infinite loop.
      if (entry.pattern.lastIndex === m.index) entry.pattern.lastIndex++;
    }

    results.push({ ruleName: rule.name, severity: rule.severity, matches });
  }

  return results;
}

/** Convenience wrapper: scans `text` against every policy, keyed by policy id. */
export function scanContentAgainstAllPolicies(text: string, policies: PurviewDlpPolicy[]): { policyId: string; policyName: string; ruleResults: DlpRuleMatchResult[] }[] {
  return policies.map((policy) => ({
    policyId: policy.id,
    policyName: policy.name,
    ruleResults: scanContentAgainstPolicy(text, policy),
  }));
}
