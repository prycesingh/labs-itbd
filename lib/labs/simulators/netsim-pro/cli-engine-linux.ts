import type { LinuxCliIptablesRule, LinuxCliState } from "./cli-types";

// ===================================================================
// Linux engine — flat, no real config mode-stack. Only a root/non-root
// toggle (`sudo -i` / `su` sets isRoot; `exit` while root drops back).
// ===================================================================

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input.trim())) !== null) {
    tokens.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return tokens;
}

export function getLinuxPrompt(state: LinuxCliState): string {
  return state.isRoot ? `root@${state.hostname}:~#` : `user@${state.hostname}:~$`;
}

function pingOutput(target: string): string[] {
  const isPrivate =
    /^10\./.test(target) ||
    /^192\.168\./.test(target) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(target) ||
    target === "127.0.0.1";
  const wellKnown = ["8.8.8.8", "1.1.1.1", "8.8.4.4"].includes(target);
  const succeeds = isPrivate || wellKnown;
  const lines = [`PING ${target} (${target}) 56(84) bytes of data.`];
  if (succeeds) {
    lines.push(`64 bytes from ${target}: icmp_seq=1 ttl=117 time=11.8 ms`);
    lines.push(`64 bytes from ${target}: icmp_seq=2 ttl=117 time=12.4 ms`);
    lines.push(`64 bytes from ${target}: icmp_seq=3 ttl=117 time=11.2 ms`);
    lines.push(`64 bytes from ${target}: icmp_seq=4 ttl=117 time=12.9 ms`);
    lines.push(`--- ${target} ping statistics ---`);
    lines.push("4 packets transmitted, 4 received, 0% packet loss, time 3004ms");
  } else {
    lines.push(`--- ${target} ping statistics ---`);
    lines.push("4 packets transmitted, 0 received, 100% packet loss, time 3080ms");
  }
  return lines;
}

function tracerouteOutput(target: string): string[] {
  return [
    `traceroute to ${target} (${target}), 30 hops max, 60 byte packets`,
    " 1  10.50.0.1 (10.50.0.1)  0.412 ms  0.389 ms  0.355 ms",
    " 2  172.16.1.1 (172.16.1.1)  1.204 ms  1.180 ms  1.150 ms",
    ` 3  ${target} (${target})  11.842 ms  11.790 ms  11.703 ms`,
  ];
}

function dnsOutput(domain: string): string[] {
  return [`Server:  127.0.0.53`, `Address: 127.0.0.53#53`, "", `Non-authoritative answer:`, `Name:  ${domain}`, `Address: 93.184.216.34`];
}

export function execLinuxCommand(
  state: LinuxCliState,
  input: string,
): { state: LinuxCliState; output: string[] } {
  const trimmed = input.trim();
  if (!trimmed) return { state, output: [] };
  const tokens = tokenize(trimmed);
  const cmd = tokens[0]?.toLowerCase();

  if (cmd === "sudo" && tokens[1]?.toLowerCase() === "-i") {
    return { state: { ...state, isRoot: true }, output: [] };
  }
  if (cmd === "su") {
    return { state: { ...state, isRoot: true }, output: [] };
  }
  if (cmd === "exit") {
    if (state.isRoot) return { state: { ...state, isRoot: false }, output: [] };
    return { state, output: ["logout"] };
  }

  if (cmd === "ip") {
    const sub = tokens[1]?.toLowerCase();
    if (sub === "a" || sub === "addr") {
      if (tokens[2]?.toLowerCase() === "add" && tokens[3] && tokens[5]?.toLowerCase() === "dev") {
        const cidr = tokens[3];
        const dev = tokens[6];
        const interfaces = state.interfaces.map((i) => (i.name === dev ? { ...i, ip: cidr } : i));
        return { state: { ...state, interfaces }, output: [] };
      }
      const lines = state.interfaces.map(
        (i, idx) => `${idx + 1}: ${i.name}: <BROADCAST,MULTICAST,${i.up ? "UP" : "DOWN"}> mtu 1500\n    inet ${i.ip}`,
      );
      return { state, output: lines };
    }
    if (sub === "link" && tokens[2]?.toLowerCase() === "set") {
      const dev = tokens[3];
      const action = tokens[4]?.toLowerCase();
      if (dev && (action === "up" || action === "down")) {
        const interfaces = state.interfaces.map((i) => (i.name === dev ? { ...i, up: action === "up" } : i));
        return { state: { ...state, interfaces }, output: [] };
      }
      return { state, output: ["Error: argument \"dev\" is wrong: device not found"] };
    }
    if (sub === "route") {
      if (tokens[2]?.toLowerCase() === "add" && tokens[3] && tokens[4]?.toLowerCase() === "via") {
        const dst = tokens[3];
        const via = tokens[5];
        const dev = state.interfaces.find((i) => i.up)?.name ?? "eth0";
        return { state: { ...state, routes: [...state.routes, { dst, via, dev }] }, output: [] };
      }
      const lines = state.routes.map((r) =>
        r.dst === "default"
          ? `default via ${r.via} dev ${r.dev}`
          : `${r.dst} dev ${r.dev} proto kernel scope link src ${state.interfaces.find((i) => i.name === r.dev)?.ip ?? ""}`,
      );
      return { state, output: lines };
    }
    return { state, output: [`Object "${sub}" is unknown, try "ip help".`] };
  }

  if (cmd === "ping") {
    const target = tokens.filter((t) => !t.startsWith("-"))[1] ?? tokens[tokens.length - 1];
    if (!target || target === "ping") return { state, output: ["ping: usage error: Destination address required"] };
    return { state, output: pingOutput(target) };
  }

  if (cmd === "traceroute") {
    const target = tokens[1];
    if (!target) return { state, output: ["traceroute: missing host operand"] };
    return { state, output: tracerouteOutput(target) };
  }

  if (cmd === "ss") {
    const header = "State    Recv-Q Send-Q Local Address:Port  Peer Address:Port Process";
    const rows = state.listeningPorts.map(
      (p) => `LISTEN   0      128    0.0.0.0:${p.port}${" ".repeat(Math.max(1, 12 - String(p.port).length))}0.0.0.0:*         ${p.process}`,
    );
    return { state, output: [header, ...rows] };
  }

  if (cmd === "netstat") {
    if (tokens.includes("-rn") || tokens[1]?.toLowerCase() === "-rn") {
      const header = "Kernel IP routing table\nDestination     Gateway         Genmask         Flags Iface";
      const rows = state.routes.map((r) =>
        r.dst === "default" ? `0.0.0.0         ${r.via.padEnd(15)} 0.0.0.0         UG    ${r.dev}` : `${r.dst.padEnd(15)} 0.0.0.0         255.255.255.0   U     ${r.dev}`,
      );
      return { state, output: [header, ...rows] };
    }
    return { state, output: ["netstat: unsupported flag — try 'netstat -rn'"] };
  }

  if (cmd === "iptables") {
    if (tokens[1] === "-L") {
      const chains: LinuxCliIptablesRule["chain"][] = ["INPUT", "FORWARD", "OUTPUT"];
      const lines: string[] = [];
      for (const chain of chains) {
        lines.push(`Chain ${chain} (policy ACCEPT)`);
        lines.push("target     prot opt source               destination");
        for (const r of state.iptablesRules.filter((r) => r.chain === chain)) {
          lines.push(r.rule);
        }
        lines.push("");
      }
      return { state, output: lines };
    }
    if (tokens[1] === "-A") {
      const chain = tokens[2] as LinuxCliIptablesRule["chain"] | undefined;
      if (!chain || !["INPUT", "OUTPUT", "FORWARD"].includes(chain)) {
        return { state, output: ["iptables: no chain/target/match specified"] };
      }
      const rule = tokens.slice(3).join(" ");
      return { state: { ...state, iptablesRules: [...state.iptablesRules, { chain, rule }] }, output: [] };
    }
    return { state, output: ["iptables: unsupported invocation"] };
  }

  if (cmd === "uname") {
    return { state, output: [`Linux ${state.hostname} 5.15.0-76-generic #83-Ubuntu SMP x86_64 GNU/Linux`] };
  }

  if (cmd === "nslookup" || cmd === "dig") {
    const domain = tokens[1];
    if (!domain) return { state, output: [`Usage: ${cmd} <domain>`] };
    return { state, output: dnsOutput(domain) };
  }

  if (cmd === "help") {
    return {
      state,
      output: [
        "Available: ip a, ip link set <if> up|down, ip addr add <cidr> dev <if>, ip route,",
        "ip route add <net> via <gw>, ping <host>, traceroute <host>, ss -tlnp, netstat -rn,",
        "iptables -L, iptables -A <chain> <rule>, uname -a, nslookup <domain>, dig <domain>,",
        "sudo -i, su, exit, help",
      ],
    };
  }

  return { state, output: [`bash: ${tokens[0]}: command not found`] };
}

export function getLinuxSuggestions(state: LinuxCliState, partial: string): string[] {
  const tokens = tokenize(partial);
  const last = (tokens[tokens.length - 1] ?? "").toLowerCase();
  const top = ["ip", "ping", "traceroute", "ss", "netstat", "iptables", "uname", "nslookup", "dig", "sudo", "su", "exit", "help"];
  if (tokens.length <= 1) return top.filter((o) => o.startsWith(last));
  if (tokens[0]?.toLowerCase() === "ip") {
    return ["a", "addr", "link", "route"].filter((o) => o.startsWith(last));
  }
  return [];
}
