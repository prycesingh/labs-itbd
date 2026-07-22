// ===== Packet dissection tree =====

export type WsTreeNode = {
  label: string;
  value?: string;
  children?: WsTreeNode[];
};

// ===== TCP flags =====

export type WsTcpFlags = {
  syn?: boolean;
  ack?: boolean;
  fin?: boolean;
  rst?: boolean;
  psh?: boolean;
  urg?: boolean;
};

export type WsHttpRequest = { method: string; host: string; path: string };
export type WsHttpResponse = { code: number; text: string };

// ===== Packet =====

export type WsPacket = {
  no: number;
  time: number;
  timeAbs: string;
  delta: number;
  src: string;
  srcMac: string;
  dst: string;
  dstMac: string;
  protocol: string;
  length: number;
  info: string;
  tree: WsTreeNode[];
  bytes: string;
  color: string;
  stream: string;
  tcpFlags?: WsTcpFlags;
  httpReq?: WsHttpRequest;
  httpResp?: WsHttpResponse;
  dnsQ?: string;
  dnsType?: string;
  srcPort?: number;
  dstPort?: number;
  tlsType?: string;
  suspicious?: boolean;
  marked: boolean;
  ignored: boolean;
};

// ===== Filter engine (typed AST — mirrors wireshark-filter.js) =====

export type WsFilterAstCmp = {
  type: "cmp";
  field: string;
  op: "==" | "!=" | "<" | ">" | "<=" | ">=" | "contains" | "matches";
  value: string;
};

export type WsFilterAstFlag = { type: "flag"; field: string };
export type WsFilterAstNot = { type: "not"; expr: WsFilterAst };
export type WsFilterAstAnd = { type: "and"; left: WsFilterAst; right: WsFilterAst };
export type WsFilterAstOr = { type: "or"; left: WsFilterAst; right: WsFilterAst };

export type WsFilterAst = WsFilterAstCmp | WsFilterAstFlag | WsFilterAstNot | WsFilterAstAnd | WsFilterAstOr;

export type WsFilterCompileResult = {
  ok: boolean;
  predicate: ((packet: WsPacket) => boolean) | null;
  ast: WsFilterAst | null;
  error: string | null;
};

export type WsFieldCatalogEntry = { field: string; type: "string" | "number" | "boolean" | "array"; description: string };

// ===== Coloring rules =====

export type WsColoringRule = {
  id: string;
  name: string;
  filter: string;
  bg: string;
  fg: string;
  enabled: boolean;
};

// ===== Saved / recent filters (one canonical schema — fixes source's split storage) =====

export type WsSavedFilter = { id: string; name: string; expr: string };

// ===== Preferences =====

export type WsColumnPrefs = {
  showNo: boolean;
  showTime: boolean;
  showSrc: boolean;
  showDst: boolean;
  showProtocol: boolean;
  showLength: boolean;
  showInfo: boolean;
};

export type WsPrefs = {
  columns: WsColumnPrefs;
  timeFormat: "seconds-since-start" | "utc" | "delta";
};

export type WsProfile = { name: string };

// ===== Capture interfaces (real, now actually surfaced in the UI) =====

export type WsInterface = { id: string; name: string; description: string; packetsCaptured: number };

// ===== Capture engine state =====

export type WsCaptureStatus = "idle" | "capturing" | "stopped";

// ===== Statistics (computed, not stored — types for the computed shapes) =====

export type WsProtocolHierarchyNode = {
  protocol: string;
  packets: number;
  bytes: number;
  pctPackets: number;
  pctBytes: number;
  children: WsProtocolHierarchyNode[];
};

export type WsConversation = {
  key: string;
  layer: "eth" | "ipv4" | "tcp" | "udp";
  a: string;
  b: string;
  packetsAtoB: number;
  packetsBtoA: number;
  bytesAtoB: number;
  bytesBtoA: number;
  duration: number;
};

export type WsEndpoint = {
  layer: "eth" | "ipv4" | "tcp" | "udp";
  address: string;
  packets: number;
  bytes: number;
  txPackets: number;
  rxPackets: number;
};

export type WsIoGraphBucket = { bucketStart: number; packets: number; bytes: number };

// ===== Root state =====

export type WiresharkState = {
  packets: WsPacket[];
  nextFrameNo: number;
  interfaces: WsInterface[];
  activeInterfaceId: string;
  captureStatus: WsCaptureStatus;
  displayFilter: string;
  selectedPacketNo: number | null;
  markedFrames: number[];
  coloringRules: WsColoringRule[];
  savedFilters: WsSavedFilter[];
  recentFilters: string[];
  prefs: WsPrefs;
  profile: WsProfile;
};
