"use client";

import { useState } from "react";
import { toast } from "sonner";

import type {
  AvdHostPoolType,
  AvdLoadBalancing,
  AvdSchedule,
  AvdSchedulePhasePeak,
  AvdSchedulePhaseRamp,
  AvdSchedulePhaseRampDown,
  AvdScalingPlan,
  AvdState,
} from "@/lib/labs/simulators/avd/types";
import { type AvdAction, computePlannedHosts, currentPhase } from "@/lib/labs/simulators/avd/reducer";
import {
  Callout,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  NativeSelect,
  PropPair,
  SectionHeader,
  StatusBadge,
  SubTabBar,
  TabBar,
  WizardFooter,
} from "./avd-ui";
import styles from "./avd-console.module.css";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LOAD_BALANCING_CHOICES: AvdLoadBalancing[] = ["Breadth-first", "Depth-first"];

function makeSchedule(): AvdSchedule {
  return {
    name: "Weekdays",
    daysOfWeek: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    rampUp: { start: "07:00", loadBalancing: "Breadth-first", minHostsPct: 20, capacityThresholdPct: 80 },
    peak: { start: "09:00", loadBalancing: "Depth-first" },
    rampDown: { start: "18:00", loadBalancing: "Depth-first", minHostsPct: 10, capacityThresholdPct: 90, forceLogoffUsers: false, waitTimeMinutes: 30 },
    offPeak: { start: "20:00", loadBalancing: "Depth-first" },
  };
}

type WizardBasics = {
  name: string;
  resourceGroup: string;
  region: string;
  timeZone: string;
  hostPoolType: AvdHostPoolType;
  exclusionTag: string;
};

function makeWizardBasics(): WizardBasics {
  return {
    name: "",
    resourceGroup: "",
    region: "East US",
    timeZone: "Eastern Standard Time",
    hostPoolType: "Pooled",
    exclusionTag: "",
  };
}

const WIZARD_TABS = [
  { id: "basics", label: "Basics" },
  { id: "schedules", label: "Schedules" },
  { id: "pools", label: "Host pools" },
  { id: "review", label: "Review" },
];

const BLADE_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "properties", label: "Properties" },
  { id: "schedules", label: "Schedules" },
  { id: "pools", label: "Host pools" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "tags", label: "Tags" },
];

/** Editor for a single schedule's 4 phases + day toggles. Shared by wizard and blade. */
function ScheduleEditor({
  schedule,
  onChange,
}: {
  schedule: AvdSchedule;
  onChange: (patch: Partial<AvdSchedule>) => void;
}) {
  const patchRampUp = (patch: Partial<AvdSchedulePhaseRamp>) => onChange({ rampUp: { ...schedule.rampUp, ...patch } });
  const patchPeak = (patch: Partial<AvdSchedulePhasePeak>) => onChange({ peak: { ...schedule.peak, ...patch } });
  const patchRampDown = (patch: Partial<AvdSchedulePhaseRampDown>) => onChange({ rampDown: { ...schedule.rampDown, ...patch } });
  const patchOffPeak = (patch: Partial<AvdSchedulePhasePeak>) => onChange({ offPeak: { ...schedule.offPeak, ...patch } });

  const toggleDay = (day: string) => {
    const has = schedule.daysOfWeek.includes(day);
    onChange({ daysOfWeek: has ? schedule.daysOfWeek.filter((d) => d !== day) : [...schedule.daysOfWeek, day] });
  };

  return (
    <div>
      <Field label="Schedule name" required>
        <input className={styles.input} value={schedule.name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Days of week" required>
        <div className={styles.radioRow}>
          {DAYS.map((d) => (
            <label key={d} className={styles.radioOption}>
              <input type="checkbox" checked={schedule.daysOfWeek.includes(d)} onChange={() => toggleDay(d)} />
              {d}
            </label>
          ))}
        </div>
      </Field>

      <SectionHeader title="Ramp-up" sub="Hosts start turning on to meet the minimum percentage of hosts." />
      <Field label="Start time">
        <input type="time" className={styles.input} value={schedule.rampUp.start} onChange={(e) => patchRampUp({ start: e.target.value })} />
      </Field>
      <Field label="Load balancing algorithm">
        <NativeSelect value={schedule.rampUp.loadBalancing} onChange={(v) => patchRampUp({ loadBalancing: v as AvdLoadBalancing })}>
          {LOAD_BALANCING_CHOICES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Minimum % of hosts">
        <input
          type="number"
          min={0}
          max={100}
          className={styles.input}
          value={schedule.rampUp.minHostsPct}
          onChange={(e) => patchRampUp({ minHostsPct: Number(e.target.value) })}
        />
      </Field>
      <Field label="Capacity threshold %" help="Display-only in this simulator; not enforced by the scaling math.">
        <input
          type="number"
          min={0}
          max={100}
          className={styles.input}
          value={schedule.rampUp.capacityThresholdPct}
          onChange={(e) => patchRampUp({ capacityThresholdPct: Number(e.target.value) })}
        />
      </Field>

      <SectionHeader title="Peak" sub="Peak hours always target 100% of hosts." />
      <Field label="Start time">
        <input type="time" className={styles.input} value={schedule.peak.start} onChange={(e) => patchPeak({ start: e.target.value })} />
      </Field>
      <Field label="Load balancing algorithm">
        <NativeSelect value={schedule.peak.loadBalancing} onChange={(v) => patchPeak({ loadBalancing: v as AvdLoadBalancing })}>
          {LOAD_BALANCING_CHOICES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <SectionHeader title="Ramp-down" sub="Hosts drain and shut down toward the minimum percentage of hosts." />
      <Field label="Start time">
        <input type="time" className={styles.input} value={schedule.rampDown.start} onChange={(e) => patchRampDown({ start: e.target.value })} />
      </Field>
      <Field label="Load balancing algorithm">
        <NativeSelect value={schedule.rampDown.loadBalancing} onChange={(v) => patchRampDown({ loadBalancing: v as AvdLoadBalancing })}>
          {LOAD_BALANCING_CHOICES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Minimum % of hosts" help="Also reused for the Off-peak phase — there is no separate Off-peak percentage field.">
        <input
          type="number"
          min={0}
          max={100}
          className={styles.input}
          value={schedule.rampDown.minHostsPct}
          onChange={(e) => patchRampDown({ minHostsPct: Number(e.target.value) })}
        />
      </Field>
      <Field label="Capacity threshold %" help="Display-only in this simulator; not enforced by the scaling math.">
        <input
          type="number"
          min={0}
          max={100}
          className={styles.input}
          value={schedule.rampDown.capacityThresholdPct}
          onChange={(e) => patchRampDown({ capacityThresholdPct: Number(e.target.value) })}
        />
      </Field>
      <Checkbox label="Force logoff users" checked={schedule.rampDown.forceLogoffUsers} onChange={(v) => patchRampDown({ forceLogoffUsers: v })} />
      <Field label="Wait time (minutes)">
        <input
          type="number"
          min={0}
          className={styles.input}
          value={schedule.rampDown.waitTimeMinutes}
          onChange={(e) => patchRampDown({ waitTimeMinutes: Number(e.target.value) })}
        />
      </Field>

      <SectionHeader title="Off-peak" sub="Lowest-usage hours. Reuses ramp-down's minimum host percentage." />
      <Field label="Start time">
        <input type="time" className={styles.input} value={schedule.offPeak.start} onChange={(e) => patchOffPeak({ start: e.target.value })} />
      </Field>
      <Field label="Load balancing algorithm">
        <NativeSelect value={schedule.offPeak.loadBalancing} onChange={(v) => patchOffPeak({ loadBalancing: v as AvdLoadBalancing })}>
          {LOAD_BALANCING_CHOICES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
}

function PhasePreview({ plan }: { plan: AvdScalingPlan }) {
  const info = currentPhase(plan);
  return (
    <Callout tone="info">
      Current phase: <strong>{info.phase}</strong>
      {info.next ? ` — next: ${info.next.name}` : ""}
    </Callout>
  );
}

export function ScalingPlansPage({ state, dispatch }: { state: AvdState; dispatch: React.Dispatch<AvdAction> }) {
  const [view, setView] = useState<"list" | "wizard" | "detail">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bladeSection, setBladeSection] = useState<string>("overview");

  // Wizard state
  const [wizardTab, setWizardTab] = useState<string>("basics");
  const [wizardBasics, setWizardBasics] = useState<WizardBasics>(makeWizardBasics());
  const [wizardSchedules, setWizardSchedules] = useState<AvdSchedule[]>([makeSchedule()]);
  const [wizardPools, setWizardPools] = useState<string[]>([]);
  const [wizardOverrides, setWizardOverrides] = useState<Record<string, boolean>>({});

  const selectedPlan = selectedId ? state.scalingPlans.find((p) => p.id === selectedId) ?? null : null;

  function openWizard() {
    setWizardBasics(makeWizardBasics());
    setWizardSchedules([makeSchedule()]);
    setWizardPools([]);
    setWizardOverrides({});
    setWizardTab("basics");
    setView("wizard");
  }

  function openDetail(id: string) {
    setSelectedId(id);
    setBladeSection("overview");
    setView("detail");
  }

  function commitWizard() {
    if (!wizardBasics.name.trim()) {
      toast.error("Plan name is required.");
      setWizardTab("basics");
      return;
    }
    const plan: AvdScalingPlan = {
      id: "sp-" + crypto.randomUUID(),
      name: wizardBasics.name.trim(),
      resourceGroup: wizardBasics.resourceGroup,
      region: wizardBasics.region,
      timeZone: wizardBasics.timeZone,
      hostPoolType: wizardBasics.hostPoolType,
      exclusionTag: wizardBasics.exclusionTag,
      schedules: wizardSchedules,
      hostPoolAssignments: wizardPools,
      poolOverrides: wizardOverrides,
      enabled: true,
      tags: {},
    };
    dispatch({ type: "ADD_SCALING_PLAN", plan });
    toast.success(`Scaling plan '${plan.name}' created.`);
    setView("list");
  }

  if (view === "wizard") {
    return (
      <div className={styles.wizard}>
        <TabBar tabs={WIZARD_TABS} active={wizardTab} onChange={setWizardTab} />
        <div className={styles.wizBody}>
          {wizardTab === "basics" ? (
            <div>
              <SectionHeader title="Basics" sub="Define the scaling plan's identity and scope." />
              <Field label="Name" required>
                <input
                  className={styles.input}
                  value={wizardBasics.name}
                  onChange={(e) => setWizardBasics({ ...wizardBasics, name: e.target.value })}
                  placeholder="e.g., sp-business-hours"
                />
              </Field>
              <Field label="Resource group" required>
                <NativeSelect value={wizardBasics.resourceGroup} onChange={(v) => setWizardBasics({ ...wizardBasics, resourceGroup: v })}>
                  <option value="">(select a resource group)</option>
                  {state.resourceGroups.map((rg) => (
                    <option key={rg.name} value={rg.name}>
                      {rg.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Region">
                <NativeSelect value={wizardBasics.region} onChange={(v) => setWizardBasics({ ...wizardBasics, region: v })}>
                  {state.regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Time zone">
                <input
                  className={styles.input}
                  value={wizardBasics.timeZone}
                  onChange={(e) => setWizardBasics({ ...wizardBasics, timeZone: e.target.value })}
                  placeholder="e.g., Eastern Standard Time"
                />
              </Field>
              <Field label="Host pool type">
                <NativeSelect value={wizardBasics.hostPoolType} onChange={(v) => setWizardBasics({ ...wizardBasics, hostPoolType: v as AvdHostPoolType })}>
                  <option value="Pooled">Pooled</option>
                  <option value="Personal">Personal</option>
                </NativeSelect>
              </Field>
              <Field label="Exclusion tag" help="Display-only in this simulator; not enforced by the scaling math.">
                <input
                  className={styles.input}
                  value={wizardBasics.exclusionTag}
                  onChange={(e) => setWizardBasics({ ...wizardBasics, exclusionTag: e.target.value })}
                  placeholder="e.g., no-scale"
                />
              </Field>
            </div>
          ) : null}

          {wizardTab === "schedules" ? (
            <div>
              <SectionHeader title="Schedules" sub="Add one or more schedules that define ramp-up, peak, ramp-down, and off-peak phases." />
              {wizardSchedules.map((sch, i) => (
                <div key={i} className={styles.miniForm} style={{ marginBottom: 16 }}>
                  <h4>
                    Schedule {i + 1}
                    <button
                      type="button"
                      className={styles.link}
                      style={{ marginLeft: 12 }}
                      onClick={() => setWizardSchedules(wizardSchedules.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </button>
                  </h4>
                  <ScheduleEditor
                    schedule={sch}
                    onChange={(patch) =>
                      setWizardSchedules(wizardSchedules.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
                    }
                  />
                </div>
              ))}
              <button type="button" className={styles.btnOutline} onClick={() => setWizardSchedules([...wizardSchedules, makeSchedule()])}>
                + Add schedule
              </button>
            </div>
          ) : null}

          {wizardTab === "pools" ? (
            <div>
              <SectionHeader title="Host pools" sub="Assign this scaling plan to one or more host pools." />
              {state.hostPools.length === 0 ? (
                <EmptyState message="No host pools available." />
              ) : (
                state.hostPools.map((hp) => {
                  const on = wizardPools.includes(hp.name);
                  return (
                    <div key={hp.id} style={{ marginBottom: 8 }}>
                      <Checkbox
                        label={`${hp.name} (${hp.type})`}
                        checked={on}
                        onChange={(checked) => {
                          setWizardPools(checked ? [...wizardPools, hp.name] : wizardPools.filter((n) => n !== hp.name));
                          if (!checked) {
                            const next = { ...wizardOverrides };
                            delete next[hp.name];
                            setWizardOverrides(next);
                          }
                        }}
                      />
                      {on ? (
                        <div style={{ paddingLeft: 24 }}>
                          <Checkbox
                            label="Enable autoscale override for this pool"
                            checked={!!wizardOverrides[hp.name]}
                            onChange={(checked) => setWizardOverrides({ ...wizardOverrides, [hp.name]: checked })}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          ) : null}

          {wizardTab === "review" ? (
            <div>
              <SectionHeader title="Review + create" sub="Confirm the scaling plan configuration before creating it." />
              <PropPair label="Name" value={wizardBasics.name || "—"} />
              <PropPair label="Resource group" value={wizardBasics.resourceGroup || "—"} />
              <PropPair label="Region" value={wizardBasics.region} />
              <PropPair label="Time zone" value={wizardBasics.timeZone} />
              <PropPair label="Host pool type" value={wizardBasics.hostPoolType} />
              <PropPair label="Exclusion tag" value={wizardBasics.exclusionTag || "—"} />
              <PropPair label="Schedules" value={wizardSchedules.map((s) => s.name).join(", ") || "—"} />
              <PropPair label="Assigned host pools" value={wizardPools.join(", ") || "—"} />
            </div>
          ) : null}
        </div>
        <WizardFooter
          onCancel={() => setView("list")}
          onBack={
            wizardTab !== "basics"
              ? () => setWizardTab(WIZARD_TABS[Math.max(0, WIZARD_TABS.findIndex((t) => t.id === wizardTab) - 1)].id)
              : undefined
          }
          onNext={() => {
            const idx = WIZARD_TABS.findIndex((t) => t.id === wizardTab);
            if (wizardTab === "review") {
              commitWizard();
            } else {
              setWizardTab(WIZARD_TABS[Math.min(WIZARD_TABS.length - 1, idx + 1)].id);
            }
          }}
          nextLabel={wizardTab === "review" ? "Create" : "Next"}
        />
      </div>
    );
  }

  if (view === "detail" && selectedPlan) {
    const plan = selectedPlan;
    const info = currentPhase(plan);

    return (
      <div className={styles.blade}>
        <div className={styles.bladeTitlebar}>
          <div className={styles.bladeIcon}>SP</div>
          <div style={{ flex: 1 }}>
            <h1>{plan.name}</h1>
            <div className={styles.bladeSub}>Scaling plan · {plan.resourceGroup} · {plan.region}</div>
          </div>
          <div className={styles.bladeActions}>
            <button type="button" className={styles.actBtn} onClick={() => dispatch({ type: "TOGGLE_SCALING_PLAN_ENABLED", id: plan.id })}>
              {plan.enabled ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              className={styles.actBtn}
              onClick={() => {
                dispatch({ type: "RUN_SCALING_NOW", id: plan.id });
                const freshInfo = currentPhase(plan);
                toast.success(`Scaling plan applied. Phase = ${freshInfo.phase}`);
              }}
            >
              Run scaling now
            </button>
            <button
              type="button"
              className={`${styles.actBtn} ${styles.actBtnDelete}`}
              onClick={() => {
                if (window.confirm(`Delete scaling plan '${plan.name}'? This cannot be undone.`)) {
                  dispatch({ type: "DELETE_SCALING_PLAN", id: plan.id });
                  setView("list");
                }
              }}
            >
              Delete
            </button>
            <button type="button" className={styles.actBtn} onClick={() => setView("list")}>
              Close
            </button>
          </div>
        </div>

        <div className={styles.bladeFrame}>
          <nav className={styles.bladeNav}>
            <div className={styles.bladeHeading}>Scaling plan</div>
            {BLADE_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`${styles.bladeItem} ${bladeSection === s.id ? styles.bladeItemActive : ""}`}
                onClick={() => setBladeSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className={styles.bladeMain}>
            {bladeSection === "overview" ? (
              <div className={styles.sectionCard}>
                <h3>Overview</h3>
                <PropPair label="Name" value={plan.name} />
                <PropPair label="Resource group" value={plan.resourceGroup} />
                <PropPair label="Region" value={plan.region} />
                <PropPair label="Time zone" value={plan.timeZone} />
                <PropPair label="Host pool type" value={plan.hostPoolType} />
                <PropPair label="Status" value={<StatusBadge status={plan.enabled ? "Active" : "Inactive"} />} />
                <PropPair label="Schedules" value={plan.schedules.length} />
                <PropPair label="Assigned host pools" value={plan.hostPoolAssignments.length} />

                <div style={{ marginTop: 16 }}>
                  <PhasePreview plan={plan} />
                </div>

                <div style={{ marginTop: 16 }}>
                  <h3>Planned vs. actual hosts by assigned pool</h3>
                  {plan.hostPoolAssignments.length === 0 ? (
                    <EmptyState message="No host pools assigned to this plan." />
                  ) : (
                    <DataTable columns={["Host pool", "Total hosts", "Planned hosts", "Actual available hosts"]}>
                      {plan.hostPoolAssignments.map((poolName) => {
                        const hosts = state.sessionHosts.filter((h) => h.hostPool === poolName);
                        const planned = computePlannedHosts(plan, info, hosts.length);
                        const actual = hosts.filter((h) => h.status === "Available").length;
                        return (
                          <tr key={poolName}>
                            <td>{poolName}</td>
                            <td>{hosts.length}</td>
                            <td>{planned}</td>
                            <td>{actual}</td>
                          </tr>
                        );
                      })}
                    </DataTable>
                  )}
                </div>
              </div>
            ) : null}

            {bladeSection === "properties" ? (
              <div className={styles.sectionCard}>
                <h3>Properties</h3>
                <Field label="Time zone">
                  <input
                    className={styles.input}
                    value={plan.timeZone}
                    onChange={(e) => dispatch({ type: "UPDATE_SCALING_PLAN", id: plan.id, patch: { timeZone: e.target.value } })}
                  />
                </Field>
                <Field label="Host pool type">
                  <NativeSelect
                    value={plan.hostPoolType}
                    onChange={(v) => dispatch({ type: "UPDATE_SCALING_PLAN", id: plan.id, patch: { hostPoolType: v as AvdHostPoolType } })}
                  >
                    <option value="Pooled">Pooled</option>
                    <option value="Personal">Personal</option>
                  </NativeSelect>
                </Field>
                <Field label="Exclusion tag" help="Display-only in this simulator; not enforced by the scaling math.">
                  <input
                    className={styles.input}
                    value={plan.exclusionTag}
                    onChange={(e) => dispatch({ type: "UPDATE_SCALING_PLAN", id: plan.id, patch: { exclusionTag: e.target.value } })}
                  />
                </Field>
              </div>
            ) : null}

            {bladeSection === "schedules" ? (
              <div className={styles.sectionCard}>
                <h3>Schedules</h3>
                {plan.schedules.length === 0 ? (
                  <EmptyState message="No schedules configured for this plan." />
                ) : (
                  plan.schedules.map((sch, i) => (
                    <div key={i} className={styles.miniForm} style={{ marginBottom: 16 }}>
                      <h4>
                        {sch.name || `Schedule ${i + 1}`}
                        <button
                          type="button"
                          className={styles.link}
                          style={{ marginLeft: 12 }}
                          onClick={() => dispatch({ type: "DELETE_SCALING_SCHEDULE", id: plan.id, index: i })}
                        >
                          Delete
                        </button>
                      </h4>
                      <ScheduleEditor
                        schedule={sch}
                        onChange={(patch) => dispatch({ type: "UPDATE_SCALING_SCHEDULE", id: plan.id, index: i, patch })}
                      />
                    </div>
                  ))
                )}
                <button type="button" className={styles.btnOutline} onClick={() => dispatch({ type: "ADD_SCALING_SCHEDULE", id: plan.id, schedule: makeSchedule() })}>
                  + Add schedule
                </button>
              </div>
            ) : null}

            {bladeSection === "pools" ? (
              <div className={styles.sectionCard}>
                <h3>Host pools</h3>
                {state.hostPools.length === 0 ? (
                  <EmptyState message="No host pools available." />
                ) : (
                  state.hostPools.map((hp) => {
                    const on = plan.hostPoolAssignments.includes(hp.name);
                    return (
                      <div key={hp.id} style={{ marginBottom: 8 }}>
                        <Checkbox
                          label={`${hp.name} (${hp.type})`}
                          checked={on}
                          onChange={(checked) => dispatch({ type: "TOGGLE_SCALING_POOL", id: plan.id, poolName: hp.name, on: checked })}
                        />
                        {on ? (
                          <div style={{ paddingLeft: 24 }}>
                            <Checkbox
                              label="Enable autoscale override for this pool"
                              help="Not enforced by 'Run scaling now' in this simulator (documented gap) — the toggle is still exposed to match the source."
                              checked={!!plan.poolOverrides[hp.name]}
                              onChange={(checked) => dispatch({ type: "SET_SCALING_POOL_OVERRIDE", id: plan.id, poolName: hp.name, enabled: checked })}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}

            {bladeSection === "diagnostics" ? (
              <div className={styles.sectionCard}>
                <h3>Diagnostics</h3>
                <Callout tone="info">
                  Run the scaling plan now to apply the current phase to all assigned host pools, or apply it to a single pool below.
                </Callout>
                <div style={{ margin: "12px 0" }}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => {
                      dispatch({ type: "RUN_SCALING_NOW", id: plan.id });
                      toast.success(`Scaling plan applied. Phase = ${info.phase}`);
                    }}
                  >
                    Run scaling now
                  </button>
                </div>

                {plan.hostPoolAssignments.length === 0 ? (
                  <EmptyState message="No host pools assigned to this plan." />
                ) : (
                  plan.hostPoolAssignments.map((poolName) => {
                    const hosts = state.sessionHosts.filter((h) => h.hostPool === poolName);
                    return (
                      <div key={poolName} style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <h4 style={{ margin: 0 }}>{poolName}</h4>
                          <button
                            type="button"
                            className={styles.btnOutline}
                            onClick={() => {
                              dispatch({ type: "RUN_SCALING_POOL_NOW", id: plan.id, poolName });
                              toast.success(`Scaling plan applied. Phase = ${info.phase}`);
                            }}
                          >
                            Apply now
                          </button>
                        </div>
                        {hosts.length === 0 ? (
                          <EmptyState message="No session hosts in this pool." />
                        ) : (
                          <DataTable columns={["Session host", "Status", "Sessions", "Drain mode"]}>
                            {hosts.map((h) => (
                              <tr key={h.id}>
                                <td>{h.name}</td>
                                <td>
                                  <StatusBadge status={h.status} />
                                </td>
                                <td>{h.sessions}</td>
                                <td>{h.drainMode ? "Yes" : "No"}</td>
                              </tr>
                            ))}
                          </DataTable>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}

            {bladeSection === "tags" ? (
              <div className={styles.sectionCard}>
                <h3>Tags</h3>
                {Object.keys(plan.tags).length === 0 ? (
                  <EmptyState message="No tags on this scaling plan." />
                ) : (
                  <DataTable columns={["Name", "Value", ""]}>
                    {Object.entries(plan.tags).map(([k, v]) => (
                      <tr key={k}>
                        <td>{k}</td>
                        <td>{v}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.link}
                            onClick={() => {
                              const nextTags = { ...plan.tags };
                              delete nextTags[k];
                              dispatch({ type: "UPDATE_SCALING_PLAN", id: plan.id, patch: { tags: nextTags } });
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                )}
                <AddTagForm
                  onAdd={(key, value) => dispatch({ type: "UPDATE_SCALING_PLAN", id: plan.id, patch: { tags: { ...plan.tags, [key]: value } } })}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.listHeader}>
        <div>
          <h1>Scaling plans</h1>
          <div className="sub">Automate host pool scaling with schedule-based ramp-up, peak, ramp-down, and off-peak phases.</div>
        </div>
        <button type="button" className={styles.btn} onClick={openWizard}>
          + Create
        </button>
      </div>
      <div className={styles.listBody}>
        {state.scalingPlans.length === 0 ? (
          <EmptyState message="No scaling plans yet. Create one to automate host pool scaling." />
        ) : (
          <DataTable columns={["Name", "Time zone", "Status", "Host pool type", "Assigned pools", "Schedules", "Current phase"]}>
            {state.scalingPlans.map((p) => {
              const info = currentPhase(p);
              return (
                <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => openDetail(p.id)}>
                  <td>
                    <button type="button" className={styles.link} onClick={() => openDetail(p.id)}>
                      {p.name}
                    </button>
                  </td>
                  <td>{p.timeZone}</td>
                  <td>
                    <StatusBadge status={p.enabled ? "Active" : "Inactive"} />
                  </td>
                  <td>{p.hostPoolType}</td>
                  <td>{p.hostPoolAssignments.length}</td>
                  <td>{p.schedules.length}</td>
                  <td>{info.phase}</td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </div>
    </div>
  );
}

function AddTagForm({ onAdd }: { onAdd: (key: string, value: string) => void }) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
      <input className={styles.input} placeholder="Name" value={key} onChange={(e) => setKey(e.target.value)} style={{ maxWidth: 200 }} />
      <input className={styles.input} placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} style={{ maxWidth: 200 }} />
      <button
        type="button"
        className={styles.btnOutline}
        onClick={() => {
          const k = key.trim();
          if (!k) return;
          onAdd(k, value.trim());
          setKey("");
          setValue("");
        }}
      >
        + Add
      </button>
    </div>
  );
}
