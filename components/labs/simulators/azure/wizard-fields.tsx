import { type ReactNode, useState } from "react";

import styles from "./azure-portal.module.css";

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
