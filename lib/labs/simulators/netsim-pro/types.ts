export type NetSimTab = "dashboard" | "learn" | "topology" | "troubleshoot" | "cli" | "scenarios" | "reference";

// ===== Learn =====

export type LessonLevel = "beginner" | "intermediate" | "advanced" | "expert" | "master";

export type Lesson = {
  id: string;
  level: LessonLevel;
  order: number;
  icon: string;
  title: string;
  bodyHtml: string;
};

// ===== Topology =====

export type TopoDeviceType =
  | "router"
  | "switch"
  | "l3switch"
  | "firewall"
  | "server"
  | "pc"
  | "laptop"
  | "phone"
  | "printer"
  | "cloud"
  | "ap"
  | "wlc"
  | "ids"
  | "vpngw"
  | "dbserver"
  | "camera"
  | "internet"
  | "isp"
  | "loadbalancer"
  | "database"
  | "ups";

export type TopoDevice = { id: number; type: TopoDeviceType; x: number; y: number; name: string };
export type TopoConnection = { from: number; to: number };

export type TopoTemplate = {
  name: string;
  devices: { type: TopoDeviceType; name: string; x: number; y: number }[];
  connections: [number, number][];
};

export type TopoTool = "select" | "connect" | "erase";

export type TopoState = {
  devices: TopoDevice[];
  connections: TopoConnection[];
  nextDeviceId: number;
  selectedDeviceId: number | null;
  currentTool: TopoTool;
  zoom: number;
  pan: { x: number; y: number };
  showGrid: boolean;
};

// ===== Troubleshoot =====

export type TroubleshootStep = { q: string; yes: number | string; no: number | string };

export type TroubleshootFlow = {
  id: string;
  title: string;
  icon: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  steps: TroubleshootStep[];
};

// ===== Scenarios =====

export type ScenarioTier = "beginner" | "intermediate" | "advanced";

export type Scenario = {
  id: string;
  title: string;
  desc: string;
  tier: ScenarioTier;
  points: number;
  tasks: string[];
};

// ===== Reference =====

export type ReferenceCommand = { cmd: string; desc: string };
export type ReferenceCategory = { cat: string; cmds: ReferenceCommand[] };
export type ReferenceCard = { id: string; title: string; icon: string; categories: ReferenceCategory[] };

export type AdvancedScenarioVendor = "Cisco" | "FortiGate" | "Palo Alto" | "Juniper";

export type AdvancedScenario = {
  id: string;
  vendor: AdvancedScenarioVendor;
  category: string;
  name: string;
  description: string;
  config: string;
  verify: string;
  useCase: string;
};

// ===== Root state =====

export type NetSimProgress = {
  learn: Record<string, boolean>;
  scenarios: Record<string, boolean>;
};

export type NetSimState = {
  activeTab: NetSimTab;
  progress: NetSimProgress;
  topology: TopoState;
  troubleshootSteps: Record<string, number | null>;
  expandedLessons: Record<string, boolean>;
  levelFilter: LessonLevel | "all";
  cli: import("./cli-types").NetSimCliState;
};
