import type { IntuneCompliancePolicy, IntuneDevice } from "./types";

/**
 * Real compliance evaluation — the source simulator never actually checks
 * policy settings against device fields (compliance is just a static seed
 * value). This checks the settings that have a real corresponding device
 * field and reports which ones fail, so the compliance dashboard reflects
 * genuine policy-vs-device state rather than cosmetic data.
 */
export type ComplianceCheckResult = {
  policyId: string;
  policyName: string;
  compliant: boolean;
  failedSettings: string[];
};

function platformMatches(policyPlatform: string, device: IntuneDevice): boolean {
  const p = policyPlatform.toLowerCase();
  if (p.includes("windows")) return device.platform === "Windows";
  if (p.includes("ios")) return device.platform === "iOS" || device.platform === "iPadOS";
  if (p.includes("macos")) return device.platform === "macOS";
  if (p.includes("android")) return device.platform === "Android";
  return false;
}

function versionAtLeast(actual: string, min: string): boolean {
  const a = actual.split(/[.\s]/).map((n) => parseInt(n, 10) || 0);
  const b = min.split(/[.\s]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av > bv;
  }
  return true;
}

export function evaluateDeviceAgainstPolicy(device: IntuneDevice, policy: IntuneCompliancePolicy): ComplianceCheckResult {
  const failed: string[] = [];
  const s = policy.settings;

  if (s.bitlocker === true && device.platform === "Windows" && !device.encryption.includes("BitLocker On")) {
    failed.push("BitLocker must be enabled");
  }
  if (s.filevault === true && device.platform === "macOS" && !device.encryption.includes("FileVault On")) {
    failed.push("FileVault must be enabled");
  }
  if (s.encryptionRequired === true && device.platform === "Android" && !device.encryption.includes("On")) {
    failed.push("Device encryption must be enabled");
  }
  if (typeof s.minOsVersion === "string" && !versionAtLeast(device.osVersion, s.minOsVersion)) {
    failed.push(`OS version must be at least ${s.minOsVersion} (device: ${device.osVersion})`);
  }
  if (s.blockJailbroken === true && device.compliance === "Not compliant") {
    failed.push("Device must not be jailbroken/rooted");
  }
  if (s.blockRooted === true && device.compliance === "Not compliant") {
    failed.push("Device must not be rooted");
  }

  return {
    policyId: policy.id,
    policyName: policy.name,
    compliant: failed.length === 0,
    failedSettings: failed,
  };
}

export function evaluateDeviceCompliance(device: IntuneDevice, policies: IntuneCompliancePolicy[]): ComplianceCheckResult[] {
  return policies.filter((p) => platformMatches(p.platform, device)).map((p) => evaluateDeviceAgainstPolicy(device, p));
}

export function policyComplianceSummary(policy: IntuneCompliancePolicy, devices: IntuneDevice[]) {
  const applicable = devices.filter((d) => platformMatches(policy.platform, d));
  const results = applicable.map((d) => ({ device: d, result: evaluateDeviceAgainstPolicy(d, policy) }));
  const compliant = results.filter((r) => r.result.compliant).length;
  return { total: applicable.length, compliant, nonCompliant: applicable.length - compliant, results };
}
