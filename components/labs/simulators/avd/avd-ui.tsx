import { type ReactNode, useState } from "react";

import styles from "./avd-console.module.css";

const CREATE_NEW_VALUE = "__create_new__";

export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className={styles.wizSection}>
      <h3>{title}</h3>
      {sub ? <p>{sub}</p> : null}
    </div>
  );
}

export function Field({
  label,
  required,
  children,
  help,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  help?: string;
}) {
  return (
    <div className={styles.field}>
      <label className={`${styles.fieldLabel} ${required ? styles.required : ""}`}>{label}</label>
      <div>
        {children}
        {help ? <p className={styles.help}>{help}</p> : null}
      </div>
    </div>
  );
}

export function NativeSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={styles.select}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {help ? <p className={styles.help} style={{ paddingLeft: 24 }}>{help}</p> : null}
    </div>
  );
}

export function RadioInline({
  name,
  value,
  onChange,
  choices,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  choices: string[];
}) {
  return (
    <div className={styles.radioRow}>
      {choices.map((c) => (
        <label key={c} className={styles.radioOption}>
          <input type="radio" name={name} checked={value === c} onChange={() => onChange(c)} />
          {c}
        </label>
      ))}
    </div>
  );
}

export function Callout({ tone, children }: { tone: "info" | "warn"; children: ReactNode }) {
  return <div className={tone === "warn" ? styles.calloutWarn : styles.calloutInfo}>{children}</div>;
}

export function ResourceGroupField({
  resourceGroups,
  value,
  onChange,
  onCreate,
}: {
  resourceGroups: string[];
  value: string;
  onChange: (value: string) => void;
  onCreate: (name: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");

  return (
    <Field label="Resource group" required>
      {creating ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="e.g., rg-project-prod"
            className={styles.input}
          />
          <button
            type="button"
            className={styles.btnOutline}
            onClick={() => {
              const name = draftName.trim();
              if (!name) return;
              onCreate(name);
              onChange(name);
              setCreating(false);
              setDraftName("");
            }}
          >
            OK
          </button>
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              setCreating(false);
              setDraftName("");
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <NativeSelect
          value={value}
          onChange={(v) => {
            if (v === CREATE_NEW_VALUE) {
              setCreating(true);
              return;
            }
            onChange(v);
          }}
        >
          <option value="">(select a resource group)</option>
          {resourceGroups.map((rg) => (
            <option key={rg} value={rg}>
              {rg}
            </option>
          ))}
          <option value={CREATE_NEW_VALUE}>+ Create new</option>
        </NativeSelect>
      )}
    </Field>
  );
}

export function PropPair({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.propPair}>
      <div className={styles.propLabel}>{label}</div>
      <div className={styles.propValue}>{value ?? "—"}</div>
    </div>
  );
}

const STATUS_TONE: Record<string, "run" | "stop" | "warn" | "neutral"> = {
  Available: "run",
  Active: "run",
  Succeeded: "run",
  Completed: "run",
  Running: "run",
  Unavailable: "stop",
  Failed: "stop",
  Shutdown: "neutral",
  Inactive: "neutral",
  "Not started": "neutral",
  "Not run": "neutral",
  Upgrading: "warn",
  Validation: "warn",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  const cls = tone === "run" ? styles.badgeRunning : tone === "stop" ? styles.badgeStopped : styles.badgeOutline;
  return <span className={`${styles.badge} ${cls}`}>{status}</span>;
}

export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; done?: boolean }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className={styles.wizTabs}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`${styles.wizTab} ${active === t.id ? styles.wizTabActive : ""} ${t.done ? styles.wizTabDone : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function SubTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className={styles.subTabs}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`${styles.subTab} ${active === t.id ? styles.subTabActive : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function DataTable({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className={styles.emptyState}>{message}</div>;
}

export function WizardFooter({
  onCancel,
  onBack,
  onNext,
  nextLabel,
  backDisabled,
}: {
  onCancel: () => void;
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  backDisabled?: boolean;
}) {
  return (
    <div className={styles.wizFooter}>
      <button type="button" className={styles.btnOutline} onClick={onCancel}>
        Cancel
      </button>
      {onBack ? (
        <button type="button" className={styles.btnOutline} onClick={onBack} disabled={backDisabled}>
          Previous
        </button>
      ) : null}
      <button type="button" className={styles.btn} onClick={onNext}>
        {nextLabel}
      </button>
    </div>
  );
}
