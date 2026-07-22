"use client";

import { toast } from "sonner";

import type { M365State } from "@/lib/labs/simulators/m365/types";
import { Pill, StatRow } from "./m365-ui";
import styles from "./m365-console.module.css";

type SetupStatus = "Complete" | "In progress" | "Pending";

type SetupTask = {
  area: string;
  task: string;
  desc: string;
  status: SetupStatus;
};

const TASKS: SetupTask[] = [
  { area: "Sign-in & security", task: "Add additional admins", desc: "3 Global Admins, 2 Privileged Role Admins, 1 Security Admin assigned.", status: "Complete" },
  { area: "Sign-in & security", task: "Enable Conditional Access", desc: "Policies cover MFA and risky sign-ins. Security Defaults disabled in favor of CA.", status: "Complete" },
  { area: "Sign-in & security", task: "Enable self-service password reset", desc: "SSPR enabled for all users. Two reset methods required.", status: "Complete" },
  { area: "Domains", task: "Add and verify a custom domain", desc: "cloudlab.in verified. MX, SPF, DKIM, DMARC records all set.", status: "Complete" },
  { area: "Domains", task: "Verify SPF / DKIM / DMARC", desc: "DKIM enabled with 2 selectors. DMARC policy set to quarantine at 100%.", status: "Complete" },
  { area: "Domains", task: "Set the default domain", desc: "Confirm the primary accepted domain used for new mailboxes and UPNs.", status: "Pending" },
  { area: "Email", task: "Migrate mailboxes from on-prem", desc: "142 of 1248 mailboxes migrated. Batch 5 of 12 running.", status: "In progress" },
  { area: "Email", task: "Configure mail flow rules", desc: "8 transport rules active covering DLP, encryption, and attachment blocking.", status: "Complete" },
  { area: "Email", task: "Configure anti-phishing policies", desc: "Standard and Strict presets applied. Mailbox intelligence and impersonation protection on.", status: "Complete" },
  { area: "Teams", task: "Set up Teams policies", desc: "Meeting, messaging, app permission, and dial-in conferencing policies configured.", status: "Complete" },
  { area: "Teams", task: "Configure guest access", desc: "External and guest access reviewed against the org's collaboration baseline.", status: "In progress" },
  { area: "SharePoint", task: "Configure default sharing", desc: "External sharing set to new and existing guests. Anyone links disabled.", status: "Complete" },
  { area: "SharePoint", task: "Set default storage quota", desc: "Per-site quota and site creation permissions reviewed.", status: "Pending" },
  { area: "Migration", task: "Move OneDrive content from on-prem", desc: "Migration tool used. 4.2 TB migrated with zero errors.", status: "Complete" },
  { area: "Migration", task: "Deploy Office apps", desc: "892 of 1248 users have the current channel installed via Monthly Enterprise Channel.", status: "In progress" },
  { area: "Migration", task: "Run the Microsoft Purview compliance setup wizard", desc: "Prerequisite: Compliance admin assigned. Not yet started.", status: "Pending" },
];

const AREA_ORDER = ["Sign-in & security", "Domains", "Email", "Teams", "SharePoint", "Migration"];

function statusTone(status: SetupStatus): "ok" | "warn" | "muted" {
  if (status === "Complete") return "ok";
  if (status === "In progress") return "warn";
  return "muted";
}

export function SetupPage({ state }: { state: M365State }) {
  void state;

  const total = TASKS.length;
  const done = TASKS.filter((t) => t.status === "Complete").length;
  const inProgress = TASKS.filter((t) => t.status === "In progress").length;

  return (
    <div>
      <h1 className={styles.pageH1}>Setup</h1>
      <p className={styles.pageSub}>Onboarding checklist for getting your tenant production-ready.</p>

      <StatRow
        stats={[
          { label: "Tasks complete", value: `${done} of ${total}` },
          { label: "In progress", value: inProgress },
          { label: "Pending", value: total - done - inProgress },
        ]}
      />

      {AREA_ORDER.map((area) => {
        const tasks = TASKS.filter((t) => t.area === area);
        if (!tasks.length) return null;
        return (
          <div key={area} className={styles.card}>
            <div className={styles.cardTitle}>{area}</div>
            {tasks.map((t) => (
              <div key={t.task} className={styles.reviewGrid} style={{ gridTemplateColumns: "1fr auto auto" }}>
                <div>
                  <strong>{t.task}</strong>
                  <div className={styles.muted}>{t.desc}</div>
                </div>
                <div>
                  <Pill tone={statusTone(t.status)}>{t.status}</Pill>
                </div>
                <button
                  type="button"
                  className={styles.btnSubtle}
                  onClick={() => toast.info("This would deep-link into the relevant admin page in the real product.")}
                >
                  Go to task
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
