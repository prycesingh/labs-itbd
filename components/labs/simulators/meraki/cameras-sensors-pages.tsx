"use client";

// Cameras (MV) and Sensors (MT) pages for the Cisco Meraki dashboard
// simulator. Ported from itbd-lab/simulators/meraki/js/meraki-portal.js
// renderCameras()/renderSensors() (both inline in the portal shell — source
// has no dedicated meraki-camera.js/meraki-sensor.js, unlike wireless/
// switch/security). Source's `mv-list` table renders name/model/serial/lanIp/
// resolution/retention/status; `mt-list` renders name/model/serial/temp/
// humidity/battery/threshold-state. Both are read-mostly in source — no live
// motion simulation for cameras (`mv-list`'s "Recent motion / person events"
// table is a static slice of `state.cameraEvents`), and sensor readings are a
// static-at-seed-time sine-wave-plus-jitter model (seedSensorReadings()), not
// live-ticking after load. The reducer (lib/labs/simulators/meraki/reducer.ts)
// has no camera/sensor action, so both pages below are genuine read-only
// views over real seeded state — an improvement over source's own
// hardcoded/frozen renders (e.g. the sensor detail view here reads real
// per-sensor 24h history via Sparkline, which source's flat table never
// exposed at all).

import { useState } from "react";

import type { MerakiDevice, MerakiState } from "@/lib/labs/simulators/meraki/types";
import { DataTable, EmptyState, Flyout, Sparkline, StatusPill, statusTone, type DataTableColumn } from "./meraki-ui";
import styles from "./meraki-console.module.css";

// ===================================================================
// Cameras (MV)
// ===================================================================

function CameraDetailFlyout({ camera, state, onClose }: { camera: MerakiDevice; state: MerakiState; onClose: () => void }) {
  // Real filtered list of this camera's events — matches source's mv-list
  // "Recent motion / person events" table, but scoped per-camera instead of
  // showing the org-wide slice(0, 10). Newest first, matching source's
  // event ordering (seedCameraEvents() is already newest-first).
  const events = state.cameraEvents.filter((e) => e.serial === camera.serial);

  return (
    <Flyout title={camera.name} onClose={onClose}>
      <div className={styles.sectionTitle}>Camera details</div>
      <dl className={styles.kv}>
        <dt>Model</dt>
        <dd>{camera.model}</dd>
        <dt>Serial</dt>
        <dd className={styles.mono2}>{camera.serial}</dd>
        <dt>LAN IP</dt>
        <dd className={styles.mono2}>{camera.lanIp || "—"}</dd>
        <dt>Status</dt>
        <dd>
          <StatusPill tone={statusTone(camera.status)}>{camera.status}</StatusPill>
        </dd>
        <dt>Resolution</dt>
        <dd>{camera.resolution ?? "—"}</dd>
        <dt>Retention</dt>
        <dd>{camera.retention ?? "—"}</dd>
        <dt>Motion detection</dt>
        <dd>
          <StatusPill tone={camera.motion ? "ok" : "muted"}>{camera.motion ? "Enabled" : "Disabled"}</StatusPill>
        </dd>
        <dt>RTSP</dt>
        <dd>
          <StatusPill tone={camera.rtsp ? "ok" : "muted"}>{camera.rtsp ? "Enabled" : "Disabled"}</StatusPill>
        </dd>
        <dt>Firmware</dt>
        <dd>{camera.firmware}</dd>
        <dt>Uptime</dt>
        <dd>{camera.uptimeDays} days</dd>
      </dl>

      <div className={styles.sectionTitle}>Recent motion / person events</div>
      {events.length === 0 ? (
        <EmptyState message="No motion or person events recorded for this camera." />
      ) : (
        <DataTable
          columns={[
            { key: "ts", header: "Time", render: (e) => <span className={styles.mono2}>{e.ts}</span> },
            { key: "kind", header: "Event", render: (e) => e.kind },
          ]}
          rows={events}
          getRowKey={(e) => e.id}
          dense
        />
      )}
    </Flyout>
  );
}

export function CamCamerasPage({ state }: { state: MerakiState }) {
  const cameras = state.devices.filter((d) => d.type === "camera" && d.networkId === state.currentNetworkId);
  const [selected, setSelected] = useState<MerakiDevice | null>(null);

  const columns: DataTableColumn<MerakiDevice>[] = [
    { key: "name", header: "Name", render: (c) => c.name },
    { key: "model", header: "Model", render: (c) => c.model },
    { key: "status", header: "Status", render: (c) => <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill> },
    { key: "resolution", header: "Resolution", render: (c) => c.resolution ?? "—" },
    { key: "retention", header: "Retention", render: (c) => c.retention ?? "—" },
    {
      key: "motion",
      header: "Motion detection",
      render: (c) => <StatusPill tone={c.motion ? "ok" : "muted"}>{c.motion ? "Enabled" : "Disabled"}</StatusPill>,
    },
    {
      key: "rtsp",
      header: "RTSP",
      render: (c) => <StatusPill tone={c.rtsp ? "ok" : "muted"}>{c.rtsp ? "Enabled" : "Disabled"}</StatusPill>,
    },
  ];

  return (
    <div>
      <div className={styles.crumb}>Cameras &nbsp;&rsaquo;&nbsp; <b>Cameras</b></div>
      <h1 className={styles.pageH}>Cameras (MV)</h1>

      <div className={styles.card}>
        <div className={styles.cardH}>All cameras</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={columns}
            rows={cameras}
            getRowKey={(c) => c.serial}
            onRowClick={(c) => setSelected(c)}
            dense
            emptyMessage="No cameras in this network."
          />
        </div>
      </div>

      {selected ? <CameraDetailFlyout camera={selected} state={state} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

// ===================================================================
// Sensors (MT)
// ===================================================================

// Highlights the sensor's real 24h readings against alertThresholds, matching
// source's mt-list `s.temp > s.alertThresholds.tempMax` check but applied
// across the whole seeded history instead of only the current snapshot.
function SensorDetailFlyout({ sensor, state, onClose }: { sensor: MerakiDevice; state: MerakiState; onClose: () => void }) {
  const readings = state.sensorReadings.filter((r) => r.serial === sensor.serial).sort((a, b) => a.hour - b.hour);
  const tempSeries = readings.map((r) => r.temp);
  const humiditySeries = readings.map((r) => r.humidity);
  const thresholds = sensor.alertThresholds;
  const breaches = thresholds ? readings.filter((r) => r.temp > thresholds.tempMax || r.temp < thresholds.tempMin) : [];

  return (
    <Flyout title={sensor.name} onClose={onClose}>
      <div className={styles.sectionTitle}>Sensor details</div>
      <dl className={styles.kv}>
        <dt>Model</dt>
        <dd>{sensor.model}</dd>
        <dt>Serial</dt>
        <dd className={styles.mono2}>{sensor.serial}</dd>
        <dt>Status</dt>
        <dd>
          <StatusPill tone={statusTone(sensor.status)}>{sensor.status}</StatusPill>
        </dd>
        <dt>Current temp</dt>
        <dd>{sensor.temp !== undefined ? `${sensor.temp.toFixed(1)} °C` : "—"}</dd>
        <dt>Current humidity</dt>
        <dd>{sensor.humidity !== undefined ? `${sensor.humidity}%` : "—"}</dd>
        <dt>Battery</dt>
        <dd>{sensor.battery !== undefined ? `${sensor.battery}%` : "—"}</dd>
        <dt>Alert thresholds</dt>
        <dd>{thresholds ? `${thresholds.tempMin}°C – ${thresholds.tempMax}°C` : "—"}</dd>
      </dl>

      <div className={styles.sectionTitle}>Temperature — last 24 hours</div>
      {tempSeries.length === 0 ? (
        <EmptyState message="No temperature history recorded for this sensor." />
      ) : (
        <div className={styles.flex}>
          <Sparkline data={tempSeries} color={breaches.length > 0 ? "#d9534f" : "#5cb85c"} />
          <span className={styles.small}>
            {Math.min(...tempSeries).toFixed(1)}°C – {Math.max(...tempSeries).toFixed(1)}°C
          </span>
        </div>
      )}

      <div className={styles.sectionTitle}>Humidity — last 24 hours</div>
      {humiditySeries.length === 0 ? (
        <EmptyState message="No humidity history recorded for this sensor." />
      ) : (
        <div className={styles.flex}>
          <Sparkline data={humiditySeries} color="#5bc0de" />
          <span className={styles.small}>
            {Math.min(...humiditySeries)}% – {Math.max(...humiditySeries)}%
          </span>
        </div>
      )}

      <div className={styles.sectionTitle}>Threshold crossings</div>
      {!thresholds ? (
        <EmptyState message="No alert thresholds configured for this sensor." />
      ) : breaches.length === 0 ? (
        <EmptyState message="All 24 hourly readings stayed within the configured thresholds." />
      ) : (
        <DataTable
          columns={[
            { key: "hour", header: "Hour", render: (r) => `${r.hour}:00` },
            { key: "temp", header: "Temp", render: (r) => `${r.temp.toFixed(1)} °C` },
            {
              key: "state",
              header: "State",
              render: (r) => (
                <StatusPill tone="crit">{r.temp > thresholds.tempMax ? "Above max" : "Below min"}</StatusPill>
              ),
            },
          ]}
          rows={breaches}
          getRowKey={(r) => `${r.serial}-${r.hour}`}
          dense
        />
      )}
    </Flyout>
  );
}

export function SensorSensorsPage({ state }: { state: MerakiState }) {
  const sensors = state.devices.filter((d) => d.type === "sensor" && d.networkId === state.currentNetworkId);
  const [selected, setSelected] = useState<MerakiDevice | null>(null);

  // Matches source's mt-list `s.temp > s.alertThresholds.tempMax` check
  // (meraki-portal.js:456) for the state pill.
  function sensorTone(sensor: MerakiDevice): "ok" | "warn" | "muted" {
    if (sensor.temp === undefined || !sensor.alertThresholds) return "muted";
    return sensor.temp > sensor.alertThresholds.tempMax || sensor.temp < sensor.alertThresholds.tempMin ? "warn" : "ok";
  }

  const columns: DataTableColumn<MerakiDevice>[] = [
    { key: "name", header: "Name", render: (s) => s.name },
    { key: "model", header: "Model", render: (s) => s.model },
    { key: "temp", header: "Temp", render: (s) => (s.temp !== undefined ? `${s.temp.toFixed(1)} °C` : "—") },
    { key: "humidity", header: "Humidity", render: (s) => (s.humidity !== undefined ? `${s.humidity}%` : "—") },
    { key: "battery", header: "Battery", render: (s) => (s.battery !== undefined ? `${s.battery}%` : "—") },
    {
      key: "thresholds",
      header: "Alert thresholds",
      render: (s) => (s.alertThresholds ? `${s.alertThresholds.tempMin}°C – ${s.alertThresholds.tempMax}°C` : "—"),
    },
    {
      key: "state",
      header: "State",
      render: (s) => {
        const tone = sensorTone(s);
        return <StatusPill tone={tone}>{tone === "warn" ? "Above threshold" : tone === "ok" ? "Normal" : "Unknown"}</StatusPill>;
      },
    },
  ];

  return (
    <div>
      <div className={styles.crumb}>Sensors &nbsp;&rsaquo;&nbsp; <b>Sensors</b></div>
      <h1 className={styles.pageH}>Sensors (MT)</h1>

      <div className={styles.card}>
        <div className={styles.cardH}>All sensors</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={columns}
            rows={sensors}
            getRowKey={(s) => s.serial}
            onRowClick={(s) => setSelected(s)}
            dense
            emptyMessage="No sensors in this network."
          />
        </div>
      </div>

      {selected ? <SensorDetailFlyout sensor={selected} state={state} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
