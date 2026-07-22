import type {
  LessonLevel,
  NetSimState,
  TopoDeviceType,
  TopoState,
  TopoTool,
} from "./types";
import { TOPO_TEMPLATES } from "./content";
import type { CliHistoryEntry, CliVendorId } from "./cli-types";
import { freshNetSimCliState } from "./cli-seed";
import { execCiscoCommand, getCiscoPrompt } from "./cli-engine-cisco";
import { execFortiCommand, getFortiPrompt } from "./cli-engine-fortigate";
import { execEditPathCommand, getEditPathPrompt } from "./cli-engine-editpath";
import { execLinuxCommand, getLinuxPrompt } from "./cli-engine-linux";

// ===== Initial state =====

function freshTopoState(): TopoState {
  return {
    devices: [],
    connections: [],
    nextDeviceId: 0,
    selectedDeviceId: null,
    currentTool: "select",
    zoom: 1,
    pan: { x: 0, y: 0 },
    showGrid: true,
  };
}

export function freshNetSimState(): NetSimState {
  return {
    activeTab: "dashboard",
    progress: {
      learn: {},
      scenarios: {},
    },
    topology: freshTopoState(),
    troubleshootSteps: {},
    expandedLessons: {},
    levelFilter: "all",
    cli: freshNetSimCliState(),
  };
}

// ===== Actions =====

export type NetSimAction =
  | { type: "LOAD_STATE"; state: NetSimState }
  | { type: "SET_ACTIVE_TAB"; tab: NetSimState["activeTab"] }
  | { type: "TOGGLE_LESSON_EXPANDED"; lessonId: string }
  | { type: "MARK_LESSON"; lessonId: string; done: boolean }
  | { type: "SET_LEVEL_FILTER"; level: LessonLevel | "all" }
  | { type: "ADD_TOPO_DEVICE"; deviceType: TopoDeviceType; x: number; y: number; name?: string }
  | { type: "MOVE_TOPO_DEVICE"; id: number; x: number; y: number }
  | { type: "RENAME_TOPO_DEVICE"; id: number; name: string }
  | { type: "DELETE_TOPO_DEVICE"; id: number }
  | { type: "SELECT_TOPO_DEVICE"; id: number | null }
  | { type: "ADD_TOPO_CONNECTION"; from: number; to: number }
  | { type: "SET_TOPO_TOOL"; tool: TopoTool }
  | { type: "SET_TOPO_ZOOM"; zoom: number }
  | { type: "SET_TOPO_PAN"; x: number; y: number }
  | { type: "TOGGLE_TOPO_GRID" }
  | { type: "LOAD_TOPO_TEMPLATE"; templateIndex: number }
  | { type: "CLEAR_TOPOLOGY" }
  | { type: "LOAD_TOPOLOGY_STATE"; topology: TopoState }
  | { type: "SET_TROUBLESHOOT_STEP"; flowId: string; stepIndex: number | null }
  | { type: "TOGGLE_SCENARIO_DONE"; scenarioId: string }
  | { type: "SET_CLI_VENDOR"; vendor: CliVendorId }
  | { type: "RUN_CLI_COMMAND"; command: string }
  | { type: "CLEAR_CLI_HISTORY" }
  | { type: "RESET_CLI_VENDOR_STATE"; vendor: CliVendorId };

// ===== Helpers =====

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function clampZoom(zoom: number): number {
  return Math.max(0.3, Math.min(3, zoom));
}

function maxDeviceId(devices: TopoState["devices"]): number {
  return devices.reduce((max, d) => Math.max(max, d.id + 1), 0);
}

// Dispatches a raw command line to the currently active vendor's engine,
// returning the updated `cli` slice (vendor state + appended history) so the
// RUN_CLI_COMMAND reducer case stays a thin wrapper around this per-vendor
// switch. Each vendor engine is a pure function module (no React, no shared
// mutable state) — see cli-engine-{cisco,fortigate,editpath,linux}.ts.
function runCliCommand(cli: NetSimState["cli"], command: string): NetSimState["cli"] {
  const vendor = cli.session.activeVendor;
  let prompt: string;
  let output: string[];
  let nextCli: NetSimState["cli"];

  switch (vendor) {
    case "cisco": {
      prompt = getCiscoPrompt(cli.cisco);
      const result = execCiscoCommand(cli.cisco, command);
      output = result.output;
      nextCli = { ...cli, cisco: result.state };
      break;
    }
    case "fortigate": {
      prompt = getFortiPrompt(cli.fortigate);
      const result = execFortiCommand(cli.fortigate, command);
      output = result.output;
      nextCli = { ...cli, fortigate: result.state };
      break;
    }
    case "juniper": {
      prompt = getEditPathPrompt(cli.juniper, "juniper");
      const result = execEditPathCommand(cli.juniper, command, "juniper");
      output = result.output;
      nextCli = { ...cli, juniper: result.state };
      break;
    }
    case "paloalto": {
      prompt = getEditPathPrompt(cli.paloalto, "paloalto");
      const result = execEditPathCommand(cli.paloalto, command, "paloalto");
      output = result.output;
      nextCli = { ...cli, paloalto: result.state };
      break;
    }
    case "linux": {
      prompt = getLinuxPrompt(cli.linux);
      const result = execLinuxCommand(cli.linux, command);
      output = result.output;
      nextCli = { ...cli, linux: result.state };
      break;
    }
  }

  const entry: CliHistoryEntry = { prompt, command, output };
  return {
    ...nextCli,
    session: {
      ...nextCli.session,
      history: [...nextCli.session.history, entry],
      commandHistory: [...nextCli.session.commandHistory, command],
    },
  };
}

// ===== Reducer =====

export function netSimReducer(state: NetSimState, action: NetSimAction): NetSimState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.tab };

    case "TOGGLE_LESSON_EXPANDED": {
      const current = state.expandedLessons[action.lessonId] ?? false;
      return {
        ...state,
        expandedLessons: { ...state.expandedLessons, [action.lessonId]: !current },
      };
    }

    case "MARK_LESSON":
      return {
        ...state,
        progress: {
          ...state.progress,
          learn: { ...state.progress.learn, [action.lessonId]: action.done },
        },
      };

    case "SET_LEVEL_FILTER":
      return { ...state, levelFilter: action.level };

    case "ADD_TOPO_DEVICE": {
      const id = state.topology.nextDeviceId;
      const name = action.name ?? `${capitalize(action.deviceType)}-${id}`;
      const device = { id, type: action.deviceType, x: action.x, y: action.y, name };
      return {
        ...state,
        topology: {
          ...state.topology,
          devices: [...state.topology.devices, device],
          nextDeviceId: id + 1,
        },
      };
    }

    case "MOVE_TOPO_DEVICE": {
      const devices = state.topology.devices.map((d) =>
        d.id === action.id ? { ...d, x: action.x, y: action.y } : d,
      );
      return { ...state, topology: { ...state.topology, devices } };
    }

    case "RENAME_TOPO_DEVICE": {
      const devices = state.topology.devices.map((d) =>
        d.id === action.id ? { ...d, name: action.name } : d,
      );
      return { ...state, topology: { ...state.topology, devices } };
    }

    case "DELETE_TOPO_DEVICE": {
      const devices = state.topology.devices.filter((d) => d.id !== action.id);
      const connections = state.topology.connections.filter(
        (c) => c.from !== action.id && c.to !== action.id,
      );
      const selectedDeviceId =
        state.topology.selectedDeviceId === action.id ? null : state.topology.selectedDeviceId;
      return { ...state, topology: { ...state.topology, devices, connections, selectedDeviceId } };
    }

    case "SELECT_TOPO_DEVICE":
      return { ...state, topology: { ...state.topology, selectedDeviceId: action.id } };

    case "ADD_TOPO_CONNECTION": {
      if (action.from === action.to) return state;
      const exists = state.topology.connections.some(
        (c) =>
          (c.from === action.from && c.to === action.to) ||
          (c.from === action.to && c.to === action.from),
      );
      if (exists) return state;
      return {
        ...state,
        topology: {
          ...state.topology,
          connections: [...state.topology.connections, { from: action.from, to: action.to }],
        },
      };
    }

    case "SET_TOPO_TOOL":
      return { ...state, topology: { ...state.topology, currentTool: action.tool } };

    case "SET_TOPO_ZOOM":
      return { ...state, topology: { ...state.topology, zoom: clampZoom(action.zoom) } };

    case "SET_TOPO_PAN":
      return { ...state, topology: { ...state.topology, pan: { x: action.x, y: action.y } } };

    case "TOGGLE_TOPO_GRID":
      return { ...state, topology: { ...state.topology, showGrid: !state.topology.showGrid } };

    case "LOAD_TOPO_TEMPLATE": {
      const template = TOPO_TEMPLATES[action.templateIndex];
      if (!template) return state;
      const devices = template.devices.map((d, i) => ({
        id: i,
        type: d.type,
        x: d.x,
        y: d.y,
        name: d.name,
      }));
      const connections = template.connections.map(([from, to]) => ({ from, to }));
      return {
        ...state,
        topology: {
          ...freshTopoState(),
          devices,
          connections,
          nextDeviceId: devices.length,
          currentTool: state.topology.currentTool,
          zoom: state.topology.zoom,
          pan: state.topology.pan,
          showGrid: state.topology.showGrid,
        },
      };
    }

    case "CLEAR_TOPOLOGY":
      return {
        ...state,
        topology: {
          ...freshTopoState(),
          currentTool: state.topology.currentTool,
          zoom: state.topology.zoom,
          pan: state.topology.pan,
          showGrid: state.topology.showGrid,
        },
      };

    case "LOAD_TOPOLOGY_STATE":
      return {
        ...state,
        topology: {
          ...action.topology,
          nextDeviceId: maxDeviceId(action.topology.devices),
        },
      };

    case "SET_TROUBLESHOOT_STEP":
      return {
        ...state,
        troubleshootSteps: { ...state.troubleshootSteps, [action.flowId]: action.stepIndex },
      };

    case "TOGGLE_SCENARIO_DONE": {
      const current = state.progress.scenarios[action.scenarioId] ?? false;
      return {
        ...state,
        progress: {
          ...state.progress,
          scenarios: { ...state.progress.scenarios, [action.scenarioId]: !current },
        },
      };
    }

    case "SET_CLI_VENDOR":
      return {
        ...state,
        cli: { ...state.cli, session: { ...state.cli.session, activeVendor: action.vendor } },
      };

    case "RUN_CLI_COMMAND":
      return { ...state, cli: runCliCommand(state.cli, action.command) };

    case "CLEAR_CLI_HISTORY":
      return {
        ...state,
        cli: { ...state.cli, session: { ...state.cli.session, history: [], commandHistory: [] } },
      };

    case "RESET_CLI_VENDOR_STATE": {
      const fresh = freshNetSimCliState();
      return {
        ...state,
        cli: { ...state.cli, [action.vendor]: fresh[action.vendor] },
      };
    }

    default:
      return state;
  }
}
