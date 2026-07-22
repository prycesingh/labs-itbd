"use client";

import { useState } from "react";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable, MmcLayout, MmcTreeNode, type TreeNode } from "./mmc-console";

export function AdsiConsole({ state }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const [selected, setSelected] = useState("default:domain");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true, default: true });

  const dcParts = state.domain.fqdn.split(".").map((p) => `DC=${p}`).join(",");

  const treeRoot: TreeNode = {
    id: "root",
    icon: "AE",
    label: "ADSI Edit",
    children: [
      {
        id: "default",
        icon: "NC",
        label: `Default naming context [${state.domainControllers[0]?.name ?? "DC01"}.${state.domain.fqdn}]`,
        children: [
          { id: "default:domain", icon: "D", label: dcParts },
          ...state.ous.map((o) => ({ id: `default:ou:${o.name}`, icon: "O", label: `OU=${o.name},${dcParts}` })),
        ],
      },
      { id: "config", icon: "NC", label: "Configuration naming context" },
      { id: "schema", icon: "NC", label: "Schema naming context" },
      { id: "rootdse", icon: "NC", label: "RootDSE" },
    ],
  };

  function attributesFor(id: string): { attr: string; value: string }[] {
    if (id === "rootdse") {
      return [
        { attr: "currentTime", value: new Date().toISOString() },
        { attr: "defaultNamingContext", value: dcParts },
        { attr: "domainFunctionality", value: "7 (Windows Server 2016)" },
        { attr: "forestFunctionality", value: "7 (Windows Server 2016)" },
        { attr: "dnsHostName", value: `${state.domainControllers[0]?.name ?? "DC01"}.${state.domain.fqdn}` },
        { attr: "supportedLDAPVersion", value: "2, 3" },
      ];
    }
    if (id === "default:domain") {
      return [
        { attr: "distinguishedName", value: dcParts },
        { attr: "objectClass", value: "domainDNS" },
        { attr: "name", value: state.domain.netbios },
        { attr: "nTMixedDomain", value: "0" },
        { attr: "pwdProperties", value: "1 (DOMAIN_PASSWORD_COMPLEX)" },
      ];
    }
    if (id.startsWith("default:ou:")) {
      const ouName = id.slice(11);
      const ou = state.ous.find((o) => o.name === ouName);
      return [
        { attr: "distinguishedName", value: `OU=${ouName},${dcParts}` },
        { attr: "objectClass", value: "organizationalUnit" },
        { attr: "ou", value: ouName },
        { attr: "description", value: ou?.description ?? "" },
      ];
    }
    if (id === "config") return [{ attr: "distinguishedName", value: `CN=Configuration,${dcParts}` }, { attr: "objectClass", value: "configuration" }];
    if (id === "schema") return [{ attr: "distinguishedName", value: `CN=Schema,CN=Configuration,${dcParts}` }, { attr: "objectClass", value: "dMD" }];
    return [];
  }

  const rows = attributesFor(selected);

  return (
    <MmcLayout
      tree={
        <MmcTreeNode
          node={treeRoot}
          selected={selected}
          expanded={expanded}
          onSelect={setSelected}
          onToggle={(id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))}
        />
      }
      content={
        <>
          <ContentHeading>{selected}</ContentHeading>
          <ContentBody>
            {rows.length ? (
              <ItemListTable columns={["Attribute", "Value"]}>
                {rows.map((r) => (
                  <tr key={r.attr}>
                    <td>{r.attr}</td>
                    <td>{r.value}</td>
                  </tr>
                ))}
              </ItemListTable>
            ) : (
              <p style={{ color: "#888", padding: 12 }}>Select a naming context or object from the tree to browse its attributes.</p>
            )}
          </ContentBody>
        </>
      }
    />
  );
}
