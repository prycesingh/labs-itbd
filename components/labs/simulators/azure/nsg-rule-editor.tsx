"use client";

import { useState } from "react";

import {
  NSG_DEST_OPTIONS,
  NSG_PROTOCOLS,
  NSG_SERVICES,
  NSG_SERVICE_TAGS,
  NSG_SOURCE_OPTIONS,
  validateCidrList,
  validatePortRanges,
} from "@/lib/labs/simulators/azure/nsgData";
import type { NsgRule } from "@/lib/labs/simulators/azure/nsgTypes";
import styles from "./azure-portal.module.css";
import { Callout, Field, NativeSelect, SectionHeader } from "./wizard-fields";

type RuleErrors = Partial<Record<keyof NsgRule, string>>;

function validateRule(draft: NsgRule, existing: NsgRule[]): RuleErrors {
  const errors: RuleErrors = {};

  if (!draft.name) errors.name = "Name is required.";
  else if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(draft.name)) {
    errors.name = "Name must be 1-80 alphanumeric, underscore, period, or hyphen.";
  }

  if (isNaN(draft.priority) || draft.priority < 100 || draft.priority > 4096) {
    errors.priority = "Priority must be a number between 100 and 4096.";
  } else {
    const conflict = existing.find((x) => x.priority === draft.priority && x.id !== draft.id);
    if (conflict) errors.priority = `Priority ${draft.priority} is already used by rule "${conflict.name}".`;
  }

  if (draft.source === "IP Addresses") {
    if (!draft.sourceAddresses) errors.sourceAddresses = "Source IP addresses/CIDR ranges are required.";
    else if (!validateCidrList(draft.sourceAddresses)) {
      errors.sourceAddresses = "Invalid IP/CIDR format. Use comma-separated IPs or CIDR ranges (e.g., 10.0.0.0/24).";
    }
  }
  if (draft.dest === "IP Addresses") {
    if (!draft.destAddresses) errors.destAddresses = "Destination IP addresses/CIDR ranges are required.";
    else if (!validateCidrList(draft.destAddresses)) {
      errors.destAddresses = "Invalid IP/CIDR format. Use comma-separated IPs or CIDR ranges (e.g., 10.0.0.0/24).";
    }
  }
  if (draft.service === "Custom") {
    if (!draft.destPortRanges) errors.destPortRanges = "Destination port ranges are required when Service = Custom.";
    else if (!validatePortRanges(draft.destPortRanges)) {
      errors.destPortRanges = "Invalid port format. Use *, single port, range (1024-65535), or comma list.";
    }
  }

  return errors;
}

export function NsgRuleEditor({
  direction,
  initialDraft,
  existingRules,
  isEdit,
  onSave,
  onClose,
}: {
  direction: "Inbound" | "Outbound";
  initialDraft: NsgRule;
  existingRules: NsgRule[];
  isEdit: boolean;
  onSave: (rule: NsgRule) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<NsgRule>(initialDraft);
  const [errors, setErrors] = useState<RuleErrors>({});

  function set<K extends keyof NsgRule>(key: K, value: NsgRule[K]) {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === "service") {
        const svc = NSG_SERVICES.find((s) => s.name === value);
        if (svc && svc.name !== "Custom") {
          next.destPortRanges = svc.port;
          if (svc.protocol && svc.protocol !== "Any") next.protocol = svc.protocol;
        }
      }
      return next;
    });
  }

  function save() {
    const validationErrors = validateRule(draft, existingRules);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSave(draft);
  }

  const svc = NSG_SERVICES.find((s) => s.name === draft.service);

  return (
    <div className={styles.rulePanelOverlay} onClick={onClose}>
      <div className={styles.rulePanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.rulePanelHeader}>
          <h2>
            {isEdit ? "Edit" : "Add"} {direction.toLowerCase()} security rule
          </h2>
          <button type="button" className={styles.rulePanelClose} onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.rulePanelBody}>
          <SectionHeader title="Source" />
          <Field label="Source" required>
            <NativeSelect value={draft.source} onChange={(v) => set("source", v as NsgRule["source"])}>
              {NSG_SOURCE_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </NativeSelect>
          </Field>
          {draft.source === "IP Addresses" ? (
            <Field label="Source IP addresses/CIDR ranges" required>
              <textarea
                value={draft.sourceAddresses}
                onChange={(e) => set("sourceAddresses", e.target.value)}
                rows={3}
                placeholder="10.0.0.0/24, 192.168.1.10"
                className={styles.textarea}
              />
              {errors.sourceAddresses ? <div className={styles.validationErr}>{errors.sourceAddresses}</div> : null}
            </Field>
          ) : null}
          {draft.source === "Service Tag" ? (
            <Field label="Source service tag" required>
              <NativeSelect value={draft.sourceServiceTag} onChange={(v) => set("sourceServiceTag", v)}>
                {NSG_SERVICE_TAGS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          {draft.source === "Application security group" ? (
            <Callout tone="info">
              Application security groups allow you to group VMs and define security policies based on those
              groups. (Simulator: no ASGs defined.)
            </Callout>
          ) : null}
          {draft.source === "My IP address" ? (
            <Callout tone="info">
              Your detected IP will be used. (Simulator: <b>203.0.113.42</b>)
            </Callout>
          ) : null}
          <Field label="Source port ranges" help="A single port, range (e.g., 1024-65535), or comma list. Use * for any.">
            <input
              value={draft.sourcePortRanges}
              onChange={(e) => set("sourcePortRanges", e.target.value)}
              placeholder="* or 1024-65535"
              className={styles.input}
            />
          </Field>

          <SectionHeader title="Destination" />
          <Field label="Destination" required>
            <NativeSelect value={draft.dest} onChange={(v) => set("dest", v as NsgRule["dest"])}>
              {NSG_DEST_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </NativeSelect>
          </Field>
          {draft.dest === "IP Addresses" ? (
            <Field label="Destination IP addresses/CIDR ranges" required>
              <textarea
                value={draft.destAddresses}
                onChange={(e) => set("destAddresses", e.target.value)}
                rows={3}
                placeholder="10.0.0.0/24, 192.168.1.10"
                className={styles.textarea}
              />
              {errors.destAddresses ? <div className={styles.validationErr}>{errors.destAddresses}</div> : null}
            </Field>
          ) : null}
          {draft.dest === "Service Tag" ? (
            <Field label="Destination service tag" required>
              <NativeSelect value={draft.destServiceTag} onChange={(v) => set("destServiceTag", v)}>
                {NSG_SERVICE_TAGS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          {draft.dest === "Application security group" ? (
            <Callout tone="info">
              Application security groups allow you to group VMs and define security policies based on those
              groups. (Simulator: no ASGs defined.)
            </Callout>
          ) : null}
          {draft.dest === "VirtualNetwork" ? (
            <Callout tone="info">Traffic destined for any address within the virtual network.</Callout>
          ) : null}

          <SectionHeader title="Service" />
          <Field label="Service" required>
            <NativeSelect value={draft.service} onChange={(v) => set("service", v)}>
              {NSG_SERVICES.map((s) => (
                <option key={s.name}>{s.name}</option>
              ))}
            </NativeSelect>
          </Field>
          {draft.service === "Custom" ? (
            <Field label="Destination port ranges" required>
              <input
                value={draft.destPortRanges}
                onChange={(e) => set("destPortRanges", e.target.value)}
                placeholder="e.g., 80,443,8080-8090 or *"
                className={styles.input}
              />
              {errors.destPortRanges ? <div className={styles.validationErr}>{errors.destPortRanges}</div> : null}
            </Field>
          ) : (
            <p style={{ fontSize: 12, color: "#605e5c" }}>
              Port: <b>{svc?.port || "-"}</b> &nbsp; Protocol auto: <b>{svc?.protocol || "-"}</b>
            </p>
          )}

          <SectionHeader title="Protocol" />
          <Field label="Protocol" required>
            <NativeSelect value={draft.protocol} onChange={(v) => set("protocol", v)}>
              {NSG_PROTOCOLS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </NativeSelect>
          </Field>

          <SectionHeader title="Action" />
          <Field label="Action" required>
            <div style={{ display: "flex", gap: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="radio" checked={draft.action === "Allow"} onChange={() => set("action", "Allow")} />
                <span className={styles.actionAllow}>Allow</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="radio" checked={draft.action === "Deny"} onChange={() => set("action", "Deny")} />
                <span className={styles.actionDeny}>Deny</span>
              </label>
            </div>
          </Field>

          <SectionHeader title="Identifier" />
          <Field
            label="Priority"
            required
            help="A number between 100 and 4096. Lower number = higher priority. Must be unique within this direction."
          >
            <input
              type="number"
              min={100}
              max={4096}
              value={draft.priority}
              onChange={(e) => set("priority", parseInt(e.target.value, 10) || 0)}
              className={styles.input}
              style={{ width: 120 }}
            />
            {errors.priority ? <div className={styles.validationErr}>{errors.priority}</div> : null}
          </Field>
          <Field label="Name" required>
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g., Allow_HTTPS"
              className={styles.input}
            />
            {errors.name ? <div className={styles.validationErr}>{errors.name}</div> : null}
          </Field>
          <Field label="Description">
            <input
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="(optional)"
              className={styles.input}
            />
          </Field>
        </div>
        <div className={styles.rulePanelFooter}>
          <button type="button" className={styles.btn} onClick={save}>
            Save
          </button>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
