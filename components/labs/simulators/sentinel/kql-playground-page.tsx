"use client";

// KQL Playground — beginner Kusto Query Language tutorial/reference tool.
// Ported from itbd-lab/simulators/sentinel/js/sentinel-kql-playground.js
// (SentinelKQLPlayground IIFE: shell()/tabs()/body()/tutorialView()/
// libraryView()/operatorsView()/schemaView()). This is an ITBD-added teaching
// addition, not a real Sentinel product page — entirely static reference
// content (15 progressive lessons, 40+ query library entries, a 25-row
// operator reference, a 16-row schema browser). Content below is transcribed
// verbatim from the source data arrays (LESSONS/OPS/SCHEMA/LIBRARY).
//
// Source bug intentionally NOT replicated: the source's go()/lesson()/
// setLibCat()/toggleLib() all call `document.getElementById('mainContent')`
// with no fallback — but the real container id is `snContent`, so every
// navigation inside the KQL Playground silently no-ops in the original site.
// This port uses plain React `useState` + conditional rendering for the
// active section/lesson/category/expanded-card, which sidesteps that class
// of bug entirely — there is no manual DOM lookup to get wrong.

import { useState } from "react";

import { SeverityBadge, SubTabBar } from "./sentinel-ui";
import styles from "./sentinel-console.module.css";

// ===== Data: tutorial lessons (ported verbatim from LESSONS) =====
type Lesson = {
  title: string;
  concept: string;
  query: string;
  explanation: string;
  sampleOutput: string[][];
  cols: string[];
};

const LESSONS: Lesson[] = [
  {
    title: "1. The pipe — your first query",
    concept:
      'KQL uses a Unix-style pipe (<code>|</code>). Each pipe sends the previous output into the next operator. Read left-to-right top-to-bottom.',
    query: "SigninLogs\n| take 10",
    explanation:
      '<code>SigninLogs</code> = the table (every Entra ID sign-in event). <code>| take 10</code> = give me 10 random rows. This is the "show me anything" baseline query.',
    sampleOutput: [
      ["2026-05-16 14:42:18", "priya.s@contoso.com", "Success", "India", "Microsoft Edge"],
      ["2026-05-16 14:41:55", "amit.k@contoso.com", "Success", "India", "Outlook"],
      ["2026-05-16 14:41:11", "rita.p@contoso.com", "Failure", "Russia", "Curl"],
      ["2026-05-16 14:40:42", "aman.v@contoso.com", "Success", "India", "Teams"],
      ["... 6 more rows"],
    ],
    cols: ["TimeGenerated", "UserPrincipalName", "Status", "Location", "AppDisplayName"],
  },
  {
    title: "2. where — filter rows",
    concept: "<code>where</code> filters down to rows matching a condition. Pipe it after the table.",
    query: "SigninLogs\n| where TimeGenerated > ago(1h)\n| where ResultType != 0",
    explanation:
      '<code>ago(1h)</code> = "1 hour ago" (KQL has built-in time functions). <code>ResultType != 0</code> means sign-in was NOT successful (0 = success). Returns failed sign-ins in the last hour.',
    sampleOutput: [
      ["2026-05-16 14:41:11", "rita.p@contoso.com", "Failure", "Russia", "50126 (Invalid creds)"],
      ["2026-05-16 14:35:42", "unknown@contoso.com", "Failure", "China", "50034 (User not found)"],
      ["2026-05-16 14:21:18", "admin@contoso.com", "Failure", "India", "50053 (Account locked)"],
    ],
    cols: ["TimeGenerated", "UserPrincipalName", "Status", "Location", "ResultDescription"],
  },
  {
    title: "3. project — pick columns",
    concept: "<code>project</code> selects which columns to return (like SQL SELECT). Cuts noise. Order matters.",
    query:
      "SigninLogs\n| where TimeGenerated > ago(1h)\n| project TimeGenerated, UserPrincipalName, IPAddress, Location",
    explanation:
      "Returns ONLY 4 columns. Rest are discarded. Use <code>project-away</code> for the inverse — drop columns, keep the rest.",
    sampleOutput: [
      ["14:42:18", "priya.s@contoso.com", "203.0.113.42", "India"],
      ["14:41:55", "amit.k@contoso.com", "203.0.113.44", "India"],
      ["14:41:11", "rita.p@contoso.com", "91.121.87.18", "Russia"],
    ],
    cols: ["TimeGenerated", "UserPrincipalName", "IPAddress", "Location"],
  },
  {
    title: "4. summarize — aggregate",
    concept:
      "<code>summarize</code> = SQL GROUP BY. Aggregates rows by key columns. Use with count(), sum(), avg(), dcount() (distinct count), max(), min().",
    query:
      "SigninLogs\n| where TimeGenerated > ago(24h)\n| summarize count() by UserPrincipalName, ResultType\n| order by count_ desc",
    explanation:
      "Counts sign-ins per (user, result type) pair in last 24h. <code>count_</code> is the default name of the count column. <code>order by</code> sorts (desc = highest first).",
    sampleOutput: [
      ["priya.s@contoso.com", "0 (Success)", "42"],
      ["amit.k@contoso.com", "0 (Success)", "38"],
      ["rita.p@contoso.com", "50126 (Bad creds)", "14"],
      ["admin@contoso.com", "50053 (Locked)", "8"],
    ],
    cols: ["UserPrincipalName", "ResultType", "count_"],
  },
  {
    title: "5. bin() — time buckets",
    concept: "<code>bin()</code> rounds time into fixed buckets. Essential for time-series.",
    query:
      "SigninLogs\n| where TimeGenerated > ago(24h)\n| summarize signIns = count() by bin(TimeGenerated, 1h)\n| order by TimeGenerated asc",
    explanation:
      "<code>bin(TimeGenerated, 1h)</code> rounds every event to its containing hour. Then count per hour. Output = 24 rows showing sign-in rate per hour.",
    sampleOutput: [
      ["2026-05-16 00:00:00", "184"],
      ["2026-05-16 01:00:00", "92"],
      ["...", "..."],
      ["2026-05-16 14:00:00", "1842"],
    ],
    cols: ["TimeGenerated", "signIns"],
  },
  {
    title: "6. join — combine tables",
    concept: "<code>join</code> = SQL JOIN. Combine rows from two tables on a common field. Default is inner.",
    query:
      'let riskyUsers = AADSignInEventsBeta\n  | where RiskLevelDuringSignIn in ("high", "medium")\n  | distinct AccountUpn;\nOfficeActivity\n| where TimeGenerated > ago(1h)\n| where UserId in (riskyUsers)\n| where Operation == "New-InboxRule"',
    explanation:
      "<code>let</code> = define a variable. We first build a list of high-risk users in last 24h, then check OfficeActivity for any of them creating inbox rules (classic post-compromise behavior).",
    sampleOutput: [
      ["14:42", "rita.p@contoso.com", "New-InboxRule", "Forward to ru-mail@protonmail.com"],
      ["11:18", "dev.kavya@contoso.com", "New-InboxRule", "Forward to external personal"],
    ],
    cols: ["TimeGenerated", "UserId", "Operation", "Parameters"],
  },
  {
    title: "7. extend — compute new columns",
    concept: "<code>extend</code> adds derived columns without removing originals.",
    query:
      'SigninLogs\n| where TimeGenerated > ago(1h)\n| extend country = tostring(LocationDetails.countryOrRegion)\n| extend hour = datetime_part("Hour", TimeGenerated)\n| where country != "India" and hour < 8',
    explanation:
      "Extract <code>countryOrRegion</code> from nested JSON. Compute the hour. Filter to non-India sign-ins before 08:00 IST. Classic \"after-hours from unusual country\" hunt.",
    sampleOutput: [
      ["03:42", "kavya.d@contoso.com", "Russia", "3"],
      ["07:18", "admin@contoso.com", "China", "7"],
    ],
    cols: ["TimeGenerated", "UserPrincipalName", "country", "hour"],
  },
  {
    title: "8. mv-expand — explode arrays",
    concept: "When a column contains an array, <code>mv-expand</code> creates one row per element.",
    query:
      'AzureActivity\n| where OperationName == "Microsoft.Compute/virtualMachines/delete"\n| mv-expand Authorization\n| project TimeGenerated, Caller, Resource, Authorization',
    explanation:
      "Each <code>Authorization</code> entry becomes its own row, so you can filter on individual fields like role names or scope.",
    sampleOutput: [["14:42", "jane.d@contoso.com", "/sub/.../vm-prod-01", "Owner"]],
    cols: ["TimeGenerated", "Caller", "Resource", "Authorization"],
  },
  {
    title: "9. parse — extract from strings",
    concept: "<code>parse</code> uses templates to extract substrings.",
    query:
      "SecurityEvent\n| where EventID == 4624 and AccountType == \"User\"\n| parse EventData with * 'LogonType\">' LogonType '<' *\n| where LogonType in (\"10\", \"7\")  // RDP / unlocked",
    explanation:
      "EventData is XML. We pull out LogonType. Type 10 = RemoteInteractive (RDP). Type 7 = unlocked workstation. Filter to those.",
    sampleOutput: [
      ["14:42", "priya.s", "10 (RDP)", "DC01-NY"],
      ["14:38", "admin", "10 (RDP)", "PROD-DB-01"],
    ],
    cols: ["TimeGenerated", "AccountName", "LogonType", "Computer"],
  },
  {
    title: "10. union — combine multiple tables",
    concept: "<code>union</code> = SQL UNION ALL. Stack rows from multiple tables.",
    query:
      "union SigninLogs, AADNonInteractiveUserSignInLogs\n| where TimeGenerated > ago(1h)\n| where ResultType != 0\n| summarize failed = count() by UserPrincipalName, IPAddress",
    explanation:
      "Combines interactive + non-interactive (token refresh, API) sign-ins. Often you need both — token-theft attacks show up in non-interactive table only.",
    sampleOutput: [
      ["rita.p@contoso.com", "91.121.87.18", "14"],
      ["kavya.d@contoso.com", "185.220.101.45", "8"],
    ],
    cols: ["UserPrincipalName", "IPAddress", "failed"],
  },
  {
    title: "11. make_set / make_list — aggregate to arrays",
    concept:
      "<code>make_set</code> = distinct values into an array. <code>make_list</code> = all values (with dupes) into an array. Used inside <code>summarize</code>.",
    query:
      "SigninLogs\n| where TimeGenerated > ago(24h)\n| summarize Countries = make_set(Location), Apps = make_set(AppDisplayName), Failures = countif(ResultType != 0) by UserPrincipalName\n| where array_length(Countries) > 3",
    explanation:
      "For each user: build the set of distinct countries + apps they signed in from, plus count failures. Filter to users seen in &gt; 3 countries — strong indicator of credential abuse or impossible travel.",
    sampleOutput: [
      [
        "rita.p@contoso.com",
        '["India","Russia","Ukraine","China"]',
        '["Outlook","Edge","Curl"]',
        "14",
      ],
      [
        "admin@contoso.com",
        '["India","US","UK","Singapore","Hong Kong"]',
        '["Portal","Edge"]',
        "4",
      ],
    ],
    cols: ["UserPrincipalName", "Countries", "Apps", "Failures"],
  },
  {
    title: "12. ipv4_is_in_range — IP filtering",
    concept:
      'KQL has built-in IP CIDR matching: <code>ipv4_is_in_range(ip, "10.0.0.0/8")</code>. Useful for "exclude corp networks" or "alert on RFC1918 leak".',
    query:
      'SigninLogs\n| where TimeGenerated > ago(1h)\n| where not(ipv4_is_in_range(IPAddress, "203.0.113.0/24") or ipv4_is_in_range(IPAddress, "198.51.100.0/24"))\n| summarize Count = count() by IPAddress, UserPrincipalName',
    explanation:
      "Returns sign-ins from any IP that is NOT in our two known corp egress ranges. Combine with <code>geo_info_from_ip_address()</code> to enrich with country/city/ASN.",
    sampleOutput: [
      ["91.121.87.18", "rita.p@contoso.com", "14"],
      ["185.220.101.45", "kavya.d@contoso.com", "8"],
    ],
    cols: ["IPAddress", "UserPrincipalName", "Count"],
  },
  {
    title: "13. anomaly detection — series_decompose_anomalies",
    concept:
      "KQL ships ML primitives. <code>series_decompose_anomalies</code> finds points more than N stddev away from baseline.",
    query:
      "SigninLogs\n| where TimeGenerated > ago(14d)\n| make-series FailedSignIns = countif(ResultType != 0) default=0 on TimeGenerated step 1h by UserPrincipalName\n| extend (anomalies, score, baseline) = series_decompose_anomalies(FailedSignIns, 2.0)\n| mv-expand anomalies, FailedSignIns, TimeGenerated\n| where toint(anomalies) != 0",
    explanation:
      "Build hourly failed-sign-in series per user over 14 days. Decompose into baseline + seasonality + noise. Flag points &gt; 2 stddev from baseline. The de facto SOC anomaly query.",
    sampleOutput: [["admin@contoso.com", "2026-05-15 03:00", "142", "anomaly +"]],
    cols: ["UserPrincipalName", "TimeGenerated", "FailedSignIns", "anomalies"],
  },
  {
    title: "14. arg_max / arg_min — pick row at max value",
    concept:
      '<code>arg_max(col, *)</code> = for each group, return the FULL ROW that has the maximum <code>col</code>. Vital when you want "latest event per device".',
    query: "DeviceProcessEvents\n| where Timestamp > ago(7d)\n| summarize arg_max(Timestamp, *) by DeviceName",
    explanation:
      "For each device, return the most recent process event with ALL columns intact. Compare with <code>summarize max(Timestamp) by DeviceName</code> which only returns 2 columns.",
    sampleOutput: [
      ["DESKTOP-12", "2026-05-16 14:42", "chrome.exe", "priya.s"],
      ["LAPTOP-08", "2026-05-16 14:38", "powershell.exe", "kavya.d"],
    ],
    cols: ["DeviceName", "Timestamp", "FileName", "AccountName"],
  },
  {
    title: "15. externaldata — query a CSV without ingesting it",
    concept:
      "<code>externaldata</code> lets you query a CSV/JSON URL inline (e.g., a watchlist or TI feed) without first ingesting it as a table.",
    query:
      'let badIps = externaldata(IP:string) [@"https://example.com/badips.csv"] with(format="csv", ignoreFirstRecord=true);\nSigninLogs\n| where TimeGenerated > ago(24h)\n| where IPAddress in (badIps)',
    explanation:
      "Pulls the external list at query-time. Used for ad-hoc TI feeds before promoting them to a Watchlist. Watch the cost — re-fetched per query.",
    sampleOutput: [["14:42", "rita.p@contoso.com", "91.121.87.18", "Russia"]],
    cols: ["TimeGenerated", "UserPrincipalName", "IPAddress", "Country"],
  },
];

// ===== Data: operator reference (ported verbatim from OPS, 25 rows) =====
type OperatorRef = { op: string; ex: string; use: string };

const OPERATORS: OperatorRef[] = [
  { op: "where", ex: "| where ResultType != 0", use: "Filter rows (SQL WHERE)." },
  { op: "project", ex: "| project TimeGenerated, User, IP", use: "Pick columns (SQL SELECT)." },
  { op: "project-away", ex: "| project-away Description, Tenant", use: "Drop specific columns." },
  { op: "extend", ex: "| extend hour = hourofday(Time)", use: "Add a derived column." },
  { op: "summarize", ex: "| summarize count() by User", use: "Group + aggregate." },
  { op: "order by", ex: "| order by count_ desc", use: "Sort." },
  { op: "take / top", ex: "| top 10 by count_ desc", use: "Limit rows." },
  { op: "distinct", ex: "| distinct UserPrincipalName", use: "Unique values only." },
  { op: "join", ex: "| join kind=inner (Other) on User", use: "Combine two tables." },
  { op: "union", ex: "union TableA, TableB", use: "Stack rows from multiple tables." },
  { op: "mv-expand", ex: "| mv-expand Roles", use: "One row per array element." },
  { op: "parse", ex: '| parse Field with "key=" Value " "', use: "Extract substrings." },
  { op: "bin()", ex: "bin(TimeGenerated, 1h)", use: "Time bucketing." },
  { op: "ago()", ex: "where TimeGenerated > ago(24h)", use: "Time delta from now." },
  { op: "datetime_part()", ex: 'datetime_part("Hour", TimeGenerated)', use: "Extract Year/Month/Day/Hour." },
  { op: "tostring()", ex: "tostring(LocationDetails.country)", use: "Cast dynamic → string." },
  { op: "todynamic()", ex: "todynamic(JsonString)", use: "Parse JSON string into navigable object." },
  { op: "contains", ex: 'where Subject contains "urgent"', use: "Substring (case-insensitive)." },
  { op: "has", ex: 'where Message has "lsass.exe"', use: "Whole-token match (faster than contains)." },
  { op: "matches regex", ex: 'where Url matches regex @"\\.(tk|ml)/"', use: "PCRE regex match." },
  { op: "let", ex: "let users = T | distinct User;", use: "Define a variable for reuse." },
  { op: "iff()", ex: 'extend cat = iff(c>10, "high", "low")', use: "Inline if-then-else." },
  { op: "case()", ex: 'extend r = case(c<10, "L", c<100, "M", "H")', use: "Multi-branch if." },
  { op: "pivot", ex: "| evaluate pivot(Country, sum(count))", use: "Pivot rows to columns." },
  { op: "render", ex: "| render timechart", use: "Visualize result (timechart, columnchart, piechart, ...)." },
];

// ===== Data: schema reference (ported verbatim from SCHEMA, 16 rows) =====
type SchemaRef = { table: string; desc: string; keyFields: string };

const SCHEMA: SchemaRef[] = [
  {
    table: "SigninLogs",
    desc: "Entra ID interactive user sign-ins.",
    keyFields:
      "TimeGenerated, UserPrincipalName, ResultType, IPAddress, AppDisplayName, ClientAppUsed, ConditionalAccessStatus, RiskLevelDuringSignIn, LocationDetails (dynamic)",
  },
  {
    table: "AADNonInteractiveUserSignInLogs",
    desc: "Token refresh, app, API sign-ins.",
    keyFields: "TimeGenerated, UserPrincipalName, ResultType, IPAddress, AppDisplayName",
  },
  {
    table: "AuditLogs",
    desc: "Entra admin actions: create user, assign role, modify CA policy.",
    keyFields: "TimeGenerated, OperationName, Result, InitiatedBy, TargetResources",
  },
  {
    table: "OfficeActivity",
    desc: "M365 audit log: SharePoint/Exchange/Teams operations.",
    keyFields: "TimeGenerated, UserId, Operation, OfficeWorkload, RecordType, Parameters",
  },
  {
    table: "SecurityEvent",
    desc: "Windows Security event log (4624/4625/4634 etc).",
    keyFields: "TimeGenerated, EventID, Account, Computer, LogonType, IpAddress",
  },
  {
    table: "DeviceProcessEvents",
    desc: "Defender for Endpoint process creation events.",
    keyFields: "TimeGenerated, DeviceId, DeviceName, FileName, ProcessCommandLine, InitiatingProcessFileName",
  },
  {
    table: "DeviceNetworkEvents",
    desc: "Defender for Endpoint network connections.",
    keyFields: "TimeGenerated, DeviceId, RemoteIP, RemoteUrl, ActionType",
  },
  {
    table: "DeviceFileEvents",
    desc: "File creation/modification on endpoints.",
    keyFields: "TimeGenerated, DeviceId, FileName, FolderPath, SHA256, ActionType",
  },
  {
    table: "IdentityLogonEvents",
    desc: "Defender for Identity DC logon events.",
    keyFields: "TimeGenerated, AccountName, DeviceName, LogonType, IPAddress",
  },
  {
    table: "CloudAppEvents",
    desc: "Defender for Cloud Apps SaaS activities.",
    keyFields: "TimeGenerated, AccountObjectId, ApplicationId, ActionType, RawEventData",
  },
  {
    table: "EmailEvents",
    desc: "Defender for Office mail flow events.",
    keyFields: "TimeGenerated, NetworkMessageId, Subject, SenderFromAddress, RecipientEmailAddress, ThreatTypes",
  },
  {
    table: "AzureActivity",
    desc: "Azure ARM control plane operations.",
    keyFields: "TimeGenerated, OperationName, Caller, Resource, ActivityStatus",
  },
  {
    table: "AzureDiagnostics",
    desc: "Azure resource diagnostic logs (NSG, AppGW, Firewall...).",
    keyFields: "TimeGenerated, ResourceProvider, Category, Resource",
  },
  {
    table: "Heartbeat",
    desc: "Azure Monitor agent heartbeat.",
    keyFields: "TimeGenerated, Computer, ResourceId, OSType",
  },
  {
    table: "AZFWApplicationRule",
    desc: "Azure Firewall application rule logs.",
    keyFields: "TimeGenerated, SourceIp, Fqdn, Action, Policy, RuleCollection",
  },
  {
    table: "AZFWNetworkRule",
    desc: "Azure Firewall network rule logs.",
    keyFields: "TimeGenerated, SourceIp, DestinationIp, DestinationPort, Action",
  },
];

// ===== Data: query library (ported verbatim from LIBRARY, 40 entries) =====
type LibrarySeverity = "Critical" | "High" | "Medium" | "Low" | "Info";
type LibraryCategory = "Identity" | "Endpoint" | "Email" | "Cloud" | "Hunt" | "MITRE" | "Cost" | "TI";

type LibraryEntry = {
  id: string;
  cat: LibraryCategory;
  mitre: string;
  sev: LibrarySeverity;
  title: string;
  desc: string;
  query: string;
  tune: string;
};

const LIBRARY: LibraryEntry[] = [
  // Identity
  {
    id: "q-ident-imptravel",
    cat: "Identity",
    mitre: "Initial Access — T1078.004",
    sev: "High",
    title: "Impossible travel sign-ins (>500 km/h)",
    desc:
      "Find users who appeared to sign in from two locations physically impossible to travel between in the elapsed time. Account for VPNs + Microsoft 365 OWA proxy IPs.",
    query:
      'SigninLogs\n| where TimeGenerated > ago(24h)\n| where ResultType == 0\n| extend Country = tostring(LocationDetails.countryOrRegion), City = tostring(LocationDetails.city), Lat = todouble(LocationDetails.geoCoordinates.latitude), Long = todouble(LocationDetails.geoCoordinates.longitude)\n| where isnotempty(Lat) and isnotempty(Long)\n| sort by UserPrincipalName asc, TimeGenerated asc\n| extend PrevTime = prev(TimeGenerated, 1), PrevLat = prev(Lat, 1), PrevLong = prev(Long, 1), PrevUser = prev(UserPrincipalName, 1)\n| where UserPrincipalName == PrevUser\n| extend DistanceKm = geo_distance_2points(Long, Lat, PrevLong, PrevLat) / 1000\n| extend HoursElapsed = todouble(datetime_diff(\'second\', TimeGenerated, PrevTime)) / 3600\n| extend SpeedKmh = DistanceKm / HoursElapsed\n| where SpeedKmh > 500\n| project TimeGenerated, UserPrincipalName, PrevTime, DistanceKm, HoursElapsed, SpeedKmh, City, Country, IPAddress',
    tune:
      "Exclude known service-principal sign-ins (high false positive). Exclude VPN egress IPs from your enterprise. Watch for legitimate users on Microsoft 365 OWA where IP geolocates to a CDN edge.",
  },
  {
    id: "q-ident-bruteforce",
    cat: "Identity",
    mitre: "Credential Access — T1110",
    sev: "High",
    title: "Brute-force / password spray detection",
    desc: "Single IP attempting many different usernames against Entra ID in a short window.",
    query:
      "SigninLogs\n| where TimeGenerated > ago(1h)\n| where ResultType != 0\n| summarize FailedAttempts = count(), UniqueUsers = dcount(UserPrincipalName), Users = make_set(UserPrincipalName) by IPAddress, bin(TimeGenerated, 10m)\n| where UniqueUsers >= 5\n| where FailedAttempts >= 20\n| sort by FailedAttempts desc",
    tune:
      "Tune UniqueUsers + FailedAttempts thresholds. Exclude legacy authentication endpoints (POP/IMAP). Often the source is a single attacker IP — block at Entra Conditional Access or in your firewall.",
  },
  {
    id: "q-ident-mfa-fatigue",
    cat: "Identity",
    mitre: "Initial Access — T1621",
    sev: "High",
    title: "MFA fatigue (push-bomb) attack",
    desc: "Many MFA prompts to the same user within minutes — classic push-bomb pattern.",
    query:
      'SigninLogs\n| where TimeGenerated > ago(1h)\n| where AuthenticationDetails has "Microsoft Authenticator"\n| summarize Prompts = count(), Statuses = make_set(Status.failureReason) by UserPrincipalName, bin(TimeGenerated, 5m)\n| where Prompts >= 10\n| sort by Prompts desc',
    tune:
      "Adjust window + threshold based on your user behaviour (some admins genuinely sign in many times). Pair with sign-in from new device / country signal.",
  },
  {
    id: "q-ident-disabled-auth",
    cat: "Identity",
    mitre: "Defense Evasion — T1078",
    sev: "Medium",
    title: "Sign-in attempts to disabled accounts",
    desc: "Disabled accounts being targeted = attacker has stale user list or insider trying to revive.",
    query:
      "SigninLogs\n| where TimeGenerated > ago(7d)\n| where ResultType == 50057  // User account is disabled\n| summarize Attempts = count(), IPs = make_set(IPAddress, 10), Locations = make_set(Location, 5) by UserPrincipalName\n| where Attempts >= 5\n| sort by Attempts desc",
    tune:
      "Cross-reference with HR offboarding feed. If an offboarded account is still being hit weeks later → external attacker. If hit only locally → policy lapse.",
  },
  {
    id: "q-ident-paw-elevation",
    cat: "Identity",
    mitre: "Privilege Escalation — T1078.003",
    sev: "High",
    title: "Tier-0 PIM activations from non-PAW devices",
    desc:
      "Catch privileged role activations from devices not on the approved Privileged Access Workstation list.",
    query:
      'let pawList = dynamic([\'PAW-001\',\'PAW-002\',\'PAW-003\']);\nAuditLogs\n| where TimeGenerated > ago(24h)\n| where OperationName == "Add member to role"\n| extend Initiator = tostring(InitiatedBy.user.userPrincipalName)\n| extend Role = tostring(TargetResources[0].displayName)\n| where Role in ("Global Administrator","Privileged Role Administrator","Domain Admins")\n| join kind=inner (SigninLogs | project Initiator=UserPrincipalName, DeviceDetail) on Initiator\n| extend DeviceName = tostring(DeviceDetail.displayName)\n| where DeviceName !in (pawList)\n| project TimeGenerated, Initiator, Role, DeviceName',
    tune: "Populate pawList from your AD group of approved devices. Add managed-by-MEM as additional signal.",
  },

  // Endpoint
  {
    id: "q-ep-lsass-read",
    cat: "Endpoint",
    mitre: "Credential Access — T1003.001",
    sev: "High",
    title: "LSASS memory read (Mimikatz-style)",
    desc: "Detect processes opening LSASS for memory read — typical credential dump.",
    query:
      'DeviceProcessEvents\n| where TimeGenerated > ago(24h)\n| where InitiatingProcessFileName !in~ ("MsMpEng.exe","SenseCncProxy.exe","wmiprvse.exe")\n| join kind=inner (DeviceEvents | where ActionType == "OpenProcessApiCall" | where ProcessCommandLine contains "lsass") on DeviceId\n| project TimeGenerated, DeviceName, InitiatingProcessFileName, InitiatingProcessCommandLine, AccountName',
    tune:
      "Whitelist your AV / EDR / monitoring processes. Custom AV agents will trip. Pair with parent-process anomaly (cmd → notepad → reading LSASS = obvious).",
  },
  {
    id: "q-ep-suspicious-psh",
    cat: "Endpoint",
    mitre: "Execution — T1059.001",
    sev: "Medium",
    title: "Suspicious PowerShell — base64 + downloads",
    desc: "PowerShell launched with -enc + -nop + outbound download patterns.",
    query:
      'DeviceProcessEvents\n| where TimeGenerated > ago(24h)\n| where FileName =~ "powershell.exe"\n| where ProcessCommandLine matches regex @"(?i)(-enc|-encodedcommand|-nop|frombase64string|invoke-expression|webclient|wget|curl)"\n| project TimeGenerated, DeviceName, AccountName, InitiatingProcessFileName, ProcessCommandLine',
    tune: "Build allow-list of internal automation scripts (signed). Surface only unsigned + unusual.",
  },
  {
    id: "q-ep-uncommon-svchost",
    cat: "Endpoint",
    mitre: "Defense Evasion — T1036.005",
    sev: "High",
    title: "Process masquerading as svchost.exe",
    desc: "A non-Windows directory hosting a process named svchost.exe — classic process masquerading.",
    query:
      'DeviceProcessEvents\n| where TimeGenerated > ago(24h)\n| where FileName =~ "svchost.exe"\n| where FolderPath !startswith "C:\\\\Windows\\\\System32"\n| where FolderPath !startswith "C:\\\\Windows\\\\SysWOW64"\n| project TimeGenerated, DeviceName, AccountName, FolderPath, SHA256, InitiatingProcessFileName',
    tune: "Most environments have zero legitimate svchost.exe outside system folders. Investigate every hit.",
  },
  {
    id: "q-ep-pivoted-rdp",
    cat: "Endpoint",
    mitre: "Lateral Movement — T1021.001",
    sev: "High",
    title: "Lateral-movement chain — one host RDPs to many",
    desc: "A single source host with outbound RDP (TCP/3389) to >5 distinct destinations in an hour.",
    query:
      'DeviceNetworkEvents\n| where TimeGenerated > ago(1h)\n| where RemotePort == 3389 and ActionType == "ConnectionSuccess"\n| summarize TargetDevices = dcount(RemoteIP), Targets = make_set(RemoteIP, 20) by DeviceName, bin(TimeGenerated, 1h)\n| where TargetDevices >= 5\n| sort by TargetDevices desc',
    tune:
      "Filter known jump hosts. After a Domain Admin compromise, attackers fan out fast — this is one of the highest-value detections.",
  },
  {
    id: "q-ep-shadow-copy-delete",
    cat: "Endpoint",
    mitre: "Impact — T1490",
    sev: "High",
    title: "Volume Shadow Copies deleted (ransomware prep)",
    desc: "vssadmin.exe / wmic shadowcopy delete — ransomware typically wipes VSC before encrypting.",
    query:
      'DeviceProcessEvents\n| where TimeGenerated > ago(24h)\n| where ProcessCommandLine matches regex @"(?i)(vssadmin\\s+delete\\s+shadows|wmic\\s+shadowcopy\\s+delete|wbadmin\\s+delete\\s+catalog|bcdedit.*recoveryenabled\\s+no|cipher\\s+/w)"\n| project TimeGenerated, DeviceName, AccountName, ProcessCommandLine, InitiatingProcessFileName',
    tune:
      'Backup software may legitimately delete old shadows — whitelist. Alert at "Severity: High" — this is a late-stage ransomware indicator.',
  },

  // Email
  {
    id: "q-em-inbox-rule-malicious",
    cat: "Email",
    mitre: "Collection — T1564.008",
    sev: "High",
    title: "Malicious inbox rule (auto-delete / forward)",
    desc: "New inbox rule that hides incoming mail — common after AAD account compromise.",
    query:
      'OfficeActivity\n| where TimeGenerated > ago(24h)\n| where Operation in ("New-InboxRule","Set-InboxRule","Update-InboxRule")\n| extend Params = parse_json(Parameters)\n| extend MoveToFolder = tostring(Params[?(@.Name=="MoveToFolder")].Value), DeleteMessage = tostring(Params[?(@.Name=="DeleteMessage")].Value), ForwardTo = tostring(Params[?(@.Name=="ForwardTo")].Value)\n| where DeleteMessage == "True" or MoveToFolder has_any ("RSS","Junk","Deleted Items","Archive") or isnotempty(ForwardTo)\n| project TimeGenerated, UserId, ClientIP, MoveToFolder, DeleteMessage, ForwardTo, Parameters',
    tune:
      "Cross-reference with risky sign-in score from Entra. Most legit users do not create auto-delete rules.",
  },
  {
    id: "q-em-phish-clicked",
    cat: "Email",
    mitre: "Initial Access — T1566.002",
    sev: "High",
    title: "User clicked URL that was later determined malicious",
    desc: "Safe Links click record where the URL verdict later turned bad.",
    query:
      'UrlClickEvents\n| where TimeGenerated > ago(7d)\n| where ActionType == "ClickAllowed"\n| join kind=inner (EmailUrlInfo | where Url !startswith "https://safelinks.protection.outlook.com") on Url\n| project ClickTime=TimeGenerated, AccountUpn, Url, ReportId, ThreatTypes, IPAddress',
    tune: "Pair with EmailEvents to find sender, AccountUpn for blast radius. Block sender domain at tenant level.",
  },
  {
    id: "q-em-spam-spike",
    cat: "Email",
    mitre: "Resource Development — T1583",
    sev: "Medium",
    title: "Spam send rate spike (compromised mailbox)",
    desc: "One mailbox sending unusually high outbound volume — possible compromise + spam relay.",
    query:
      'EmailEvents\n| where TimeGenerated > ago(1h)\n| where EmailDirection == "Outbound"\n| summarize SentCount = count() by SenderFromAddress, bin(TimeGenerated, 15m)\n| where SentCount > 300\n| sort by SentCount desc',
    tune: "Per-user threshold — sales newsletters legitimately spike. Whitelist high-volume senders + identities.",
  },

  // Cloud
  {
    id: "q-cloud-rg-deletion",
    cat: "Cloud",
    mitre: "Impact — T1485",
    sev: "High",
    title: "Mass resource group deletion",
    desc:
      "Single user deleting multiple RGs in short window — destructive insider or ransomware-style impact.",
    query:
      'AzureActivity\n| where TimeGenerated > ago(1h)\n| where OperationNameValue == "Microsoft.Resources/subscriptions/resourceGroups/delete"\n| where ActivityStatusValue == "Success"\n| summarize Deletions = count(), RGs = make_set(Resource, 50) by Caller, CallerIpAddress, bin(TimeGenerated, 30m)\n| where Deletions >= 3\n| sort by Deletions desc',
    tune:
      "Highest-priority alert. Pair with Resource Locks (CanNotDelete) on tier-0 resources to prevent recurrence.",
  },
  {
    id: "q-cloud-nsg-open-all",
    cat: "Cloud",
    mitre: "Defense Evasion — T1562",
    sev: "High",
    title: "NSG rule opening any-to-any internet",
    desc: "Detect NSG changes that allow 0.0.0.0/0 inbound to any port — typical lift-the-firewall mistake.",
    query:
      'AzureActivity\n| where TimeGenerated > ago(24h)\n| where OperationNameValue startswith "Microsoft.Network/networkSecurityGroups/securityRules"\n| where ActivityStatusValue == "Success"\n| extend Properties = parse_json(tostring(parse_json(Properties).requestbody))\n| extend SrcAddr = tostring(Properties.properties.sourceAddressPrefix), Access = tostring(Properties.properties.access)\n| where Access == "Allow" and SrcAddr in ("*","0.0.0.0/0","Internet","Any")\n| project TimeGenerated, Caller, CallerIpAddress, Resource, OperationNameValue, SrcAddr',
    tune:
      "Whitelist load-balancer / Front-Door service-tag rules. Block at Azure Policy: deny NSG rules with 0.0.0.0/0 source.",
  },
  {
    id: "q-cloud-disk-snapshot-export",
    cat: "Cloud",
    mitre: "Exfiltration — T1213",
    sev: "High",
    title: "Snapshot exported / SAS URL generated",
    desc:
      "Managed disk snapshot SAS URL generation — possible exfil channel for an attacker who controls the subscription.",
    query:
      'AzureActivity\n| where TimeGenerated > ago(7d)\n| where OperationNameValue == "Microsoft.Compute/snapshots/beginGetAccess/action"\n| project TimeGenerated, Caller, CallerIpAddress, Resource',
    tune: "Catch unusual export attempts. Combine with Defender for Cloud snapshot-deletion alerts for full picture.",
  },
  {
    id: "q-cloud-aks-priv-pod",
    cat: "Cloud",
    mitre: "Privilege Escalation — T1611",
    sev: "High",
    title: "AKS privileged pod or hostNetwork pod created",
    desc: "Pod manifests with privileged: true or hostNetwork: true allow container escape.",
    query:
      'AzureDiagnostics\n| where Category == "kube-audit"\n| where TimeGenerated > ago(24h)\n| where log_s has "create" and ResourceProvider == "MICROSOFT.CONTAINERSERVICE"\n| where log_s has "privileged" or log_s has "hostNetwork"\n| project TimeGenerated, ResourceId, log_s',
    tune: "Block at policy: <code>azurepolicy-k8s</code> initiative + Gatekeeper deny.",
  },

  // Sentinel hunting
  {
    id: "q-hunt-as-rep",
    cat: "Hunt",
    mitre: "Credential Access — T1558.004",
    sev: "High",
    title: "AS-REP roasting attempt",
    desc:
      "Kerberos pre-authentication disabled (UF_DONT_REQUIRE_PREAUTH) → attacker requests TGT to crack offline.",
    query:
      'SecurityEvent\n| where TimeGenerated > ago(24h)\n| where EventID == 4768  // Kerberos TGT request\n| where TicketEncryptionType in ("0x17", "0x18")  // RC4 = brittle for AS-REP roast\n| extend Pre = tostring(EventData) has "0x0"\n| where Pre\n| project TimeGenerated, AccountName=TargetAccount, Workstation, IpAddress',
    tune: "Audit accounts with UF_DONT_REQUIRE_PREAUTH — there should be NONE in 2026.",
  },
  {
    id: "q-hunt-golden-ticket",
    cat: "Hunt",
    mitre: "Lateral Movement — T1558.001",
    sev: "Critical",
    title: "Golden ticket attack indicators",
    desc: "TGTs with anomalous lifetime + RC4 + non-default account — Golden Ticket signature.",
    query:
      'SecurityEvent\n| where TimeGenerated > ago(24h)\n| where EventID == 4624 and LogonType == 3\n| where AuthenticationPackageName =~ "Kerberos"\n| where TicketOptions !endswith "0x100000" // not standard renewable / pre-auth\n| join kind=inner (SecurityEvent | where EventID == 4769 | project TargetUserName, TicketEncryptionType, ServiceName) on $left.AccountName == $right.TargetUserName\n| where TicketEncryptionType == "0x17"\n| project TimeGenerated, AccountName, ServiceName, LogonType, TicketEncryptionType, IpAddress',
    tune:
      "Pair with abnormal-process-by-system-account hunts. Best mitigation: KRBTGT password rotated twice + Tier-0 isolation.",
  },
  {
    id: "q-hunt-dcsync",
    cat: "Hunt",
    mitre: "Credential Access — T1003.006",
    sev: "Critical",
    title: "DCSync — non-DC account replicating directory",
    desc:
      "AD replication call from a non-DC source — attacker stole DA token and is dumping NTDS.dit remotely.",
    query:
      'IdentityDirectoryEvents\n| where TimeGenerated > ago(24h)\n| where ActionType == "Directory Services Replication"\n| where DestinationDeviceName !in ("DC01","DC02","DC03")\n| project TimeGenerated, DestinationDeviceName, AccountName, AccountDomain, SourceDeviceName',
    tune: "Whitelist your DCs only. Critical alert — investigate the source workstation immediately.",
  },
  {
    id: "q-hunt-skeleton-key",
    cat: "Hunt",
    mitre: "Persistence — T1556.001",
    sev: "Critical",
    title: "Skeleton Key persistence (DC patched in-memory)",
    desc: "Hook into LSASS on DC so a master password works for any account.",
    query:
      'DeviceProcessEvents\n| where TimeGenerated > ago(24h)\n| where DeviceName startswith "DC"\n| where InitiatingProcessFileName =~ "rundll32.exe" or InitiatingProcessFileName =~ "mimikatz.exe"\n| where ProcessCommandLine has_any ("misc::skeleton","sekurlsa::","lsadump::")\n| project TimeGenerated, DeviceName, AccountName, InitiatingProcessFileName, ProcessCommandLine',
    tune:
      "Best detection requires Defender for Identity sensor on every DC. Skeleton Key needs reboot to clean — rebuild DC if confirmed.",
  },

  // MITRE general
  {
    id: "q-mitre-init-access-overview",
    cat: "MITRE",
    mitre: "Multi-tactic",
    sev: "Low",
    title: "Coverage gap — Initial Access tactics with no recent detections",
    desc:
      "For each Initial Access technique, show whether you had any matching alert in the last 30 days. Surface coverage gaps.",
    query:
      'SecurityAlert\n| where TimeGenerated > ago(30d)\n| extend Tactics = tostring(parse_json(ExtendedProperties).Tactics)\n| where Tactics has "InitialAccess"\n| extend Technique = tostring(parse_json(ExtendedProperties).Techniques)\n| summarize Alerts = count(), LastAlert = max(TimeGenerated) by Technique\n| sort by Alerts asc',
    tune:
      'Zero-hit techniques = no detections written. Decide: is this a real gap or no exposure? Map to MITRE ATT&CK Navigator JSON.',
  },
  {
    id: "q-mitre-tactic-by-product",
    cat: "MITRE",
    mitre: "Multi-tactic",
    sev: "Low",
    title: "Detection sources by MITRE tactic",
    desc: "Heatmap: which data source / product is covering which MITRE tactic in your tenant.",
    query:
      'SecurityAlert\n| where TimeGenerated > ago(30d)\n| extend Tactics = tostring(parse_json(ExtendedProperties).Tactics)\n| extend Tactic = split(Tactics, ",")\n| mv-expand Tactic to typeof(string)\n| summarize Alerts = count() by ProductName, Tactic\n| sort by Tactic asc, Alerts desc',
    tune:
      'Use this to justify additional data sources to leadership — "we have zero Defense Evasion coverage from Defender alone".',
  },

  // Performance / Cost
  {
    id: "q-cost-top-tables",
    cat: "Cost",
    mitre: "-",
    sev: "Info",
    title: "Top ingesting tables (cost optimisation)",
    desc: "Identify the most expensive tables in your workspace.",
    query:
      "Usage\n| where TimeGenerated > ago(7d)\n| where IsBillable\n| summarize TotalGB = sum(Quantity) / 1024 by DataType\n| order by TotalGB desc\n| extend EstimatedCostUSD = TotalGB * 2.30",
    tune: "Tune top 5: convert to Basic Logs / Auxiliary Logs, apply DCR transformations, exclude noisy fields.",
  },
  {
    id: "q-cost-per-host",
    cat: "Cost",
    mitre: "-",
    sev: "Info",
    title: "Top ingesting hosts",
    desc: "Find one noisy host dominating ingestion. Often a single misconfigured server or a leaking app.",
    query:
      "SecurityEvent\n| where TimeGenerated > ago(1d)\n| summarize Events = count() by Computer\n| sort by Events desc\n| take 20",
    tune:
      "Apply DCR filter to drop noisy event IDs (e.g., 4674, 4663 admin access if not needed). 80/20 rule applies.",
  },

  // Watchlist / TI
  {
    id: "q-ti-bad-ip-traffic",
    cat: "TI",
    mitre: "Command & Control — T1071",
    sev: "High",
    title: "Traffic to known-bad IPs from TI feed",
    desc: "Join CommonSecurityLog / VMConnection with the ThreatIntelligenceIndicator table.",
    query:
      'let badIps = ThreatIntelligenceIndicator\n  | where Active == true\n  | where ThreatType in ("C2","Botnet","Malware")\n  | summarize by NetworkIP;\nCommonSecurityLog\n| where TimeGenerated > ago(24h)\n| where DestinationIP in (badIps)\n| project TimeGenerated, SourceIP, SourceUserName, DestinationIP, DestinationPort, DeviceVendor, DeviceProduct',
    tune:
      "Sentinel TI table is populated by the TI connectors. Ensure your TAXII feeds are pulling fresh indicators (look at lastIngest).",
  },
  {
    id: "q-ti-watchlist-vip",
    cat: "TI",
    mitre: "Credential Access",
    sev: "Medium",
    title: "Watchlist match — sign-ins for VIP accounts",
    desc: "Track logins for a set of high-risk accounts maintained in a Watchlist.",
    query:
      '_GetWatchlist("VIP_Accounts")\n| project UPN\n| join kind=inner (SigninLogs | where TimeGenerated > ago(1h)) on $left.UPN == $right.UserPrincipalName\n| project TimeGenerated, UserPrincipalName, IPAddress, Location, AppDisplayName, ResultDescription',
    tune: "Maintain VIP_Accounts watchlist via Sentinel UI or upload CSV. Useful for executives + service-account watchlist.",
  },
];

const LIBRARY_CATEGORIES: ("All" | LibraryCategory)[] = [
  "All",
  "Identity",
  "Endpoint",
  "Email",
  "Cloud",
  "Hunt",
  "MITRE",
  "Cost",
  "TI",
];

// Renders lesson/library HTML fragments (`<code>...</code>` inline markup)
// ported verbatim from source strings. Content is static, authored reference
// text — not user input — so dangerouslySetInnerHTML here mirrors the
// source's own innerHTML usage without introducing an XSS surface.
function RichText({ html, className }: { html: string; className?: string }) {
  return <p className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function LessonSampleTable({ lesson }: { lesson: Lesson }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {lesson.cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lesson.sampleOutput.map((row, i) => (
            <tr key={i}>
              {row.length === 1 && lesson.cols.length > 1 ? (
                <td colSpan={lesson.cols.length} style={{ fontFamily: "Consolas, monospace", fontSize: 11, color: "#605e5c" }}>
                  {row[0]}
                </td>
              ) : (
                row.map((cell, j) => (
                  <td key={j} style={{ fontFamily: "Consolas, monospace", fontSize: 11 }}>
                    {cell}
                  </td>
                ))
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LessonsSection() {
  const [lessonIdx, setLessonIdx] = useState(0);
  const lesson = LESSONS[lessonIdx];

  return (
    <div>
      <div className={styles.filterRow} role="tablist" aria-label="Lesson number">
        {LESSONS.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.chip} ${i === lessonIdx ? styles.chipActive : ""}`}
            onClick={() => setLessonIdx(i)}
            aria-current={i === lessonIdx}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>{lesson.title}</div>
        <RichText html={lesson.concept} className={styles.sub} />

        <div className={styles.h3}>Query</div>
        <pre className={styles.kql} style={{ minHeight: "auto", whiteSpace: "pre-wrap" }}>
          {lesson.query}
        </pre>

        <div className={styles.h3}>Explanation</div>
        <RichText html={lesson.explanation} className={styles.sub} />

        <div className={styles.h3}>Sample result</div>
        <LessonSampleTable lesson={lesson} />

        <p className={styles.sub} style={{ marginTop: 12 }}>
          Try it: want to run something like this for real? Head to the{" "}
          <strong>Logs</strong> page and adapt this query against the live simulated
          workspace data.
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnOutline}`}
            onClick={() => setLessonIdx((i) => Math.max(0, i - 1))}
            disabled={lessonIdx === 0}
          >
            &lt; Previous lesson
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setLessonIdx((i) => Math.min(LESSONS.length - 1, i + 1))}
            disabled={lessonIdx === LESSONS.length - 1}
          >
            Next lesson &gt;
          </button>
        </div>
      </div>
    </div>
  );
}

function LibrarySection() {
  const [libCat, setLibCat] = useState<(typeof LIBRARY_CATEGORIES)[number]>("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  const items = libCat === "All" ? LIBRARY : LIBRARY.filter((q) => q.cat === libCat);

  return (
    <div>
      <p className={styles.sub}>
        {LIBRARY.length} ready-to-use Sentinel + Defender hunting queries. Click any card to see the full KQL +
        tuning notes. Filter by category:
      </p>

      <div className={styles.filterRow} role="tablist" aria-label="Library category">
        {LIBRARY_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.chip} ${libCat === c ? styles.chipActive : ""}`}
            onClick={() => {
              setLibCat(c);
              setExpanded(null);
            }}
            aria-current={libCat === c}
          >
            {c}
          </button>
        ))}
      </div>

      {items.map((q) => {
        const isOpen = expanded === q.id;
        return (
          <div
            key={q.id}
            className={styles.card}
            style={{ cursor: "pointer" }}
            onClick={() => setExpanded(isOpen ? null : q.id)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
                {q.title}
              </div>
              <SeverityBadge severity={q.sev} />
            </div>
            <div className={styles.sub} style={{ margin: "4px 0 6px" }}>
              <strong>{q.cat}</strong> &middot; {q.mitre}
            </div>
            <p style={{ fontSize: 13, color: "#323130", lineHeight: 1.55, margin: 0 }}>{q.desc}</p>

            {isOpen ? (
              <>
                <div className={styles.h3}>Query</div>
                <pre className={styles.kql} style={{ minHeight: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {q.query}
                </pre>
                <div className={styles.h3}>How to tune</div>
                <p style={{ fontSize: 13, color: "#323130", lineHeight: 1.55, margin: 0 }}>{q.tune}</p>
              </>
            ) : (
              <div className={styles.sub} style={{ marginTop: 6, fontStyle: "italic" }}>
                Click to expand query + tuning notes &raquo;
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OperatorsSection() {
  return (
    <div>
      <p className={styles.sub}>25 most-used KQL operators. Bookmark this page.</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: 160 }}>Operator</th>
              <th>Example</th>
              <th>Use</th>
            </tr>
          </thead>
          <tbody>
            {OPERATORS.map((o) => (
              <tr key={o.op}>
                <td>
                  <code style={{ background: "#f3f2f1", color: "#0078d4", padding: "1px 6px", borderRadius: 3, fontFamily: "Consolas, monospace" }}>
                    {o.op}
                  </code>
                </td>
                <td style={{ fontFamily: "Consolas, monospace", fontSize: 12 }}>{o.ex}</td>
                <td style={{ color: "#605e5c" }}>{o.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SchemaSection() {
  return (
    <div>
      <p className={styles.sub}>Top 16 tables you&apos;ll query daily in Sentinel. Each row lists the table and its key fields.</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Table</th>
              <th>Purpose</th>
              <th>Key fields</th>
            </tr>
          </thead>
          <tbody>
            {SCHEMA.map((s) => (
              <tr key={s.table}>
                <td>
                  <strong style={{ color: "#0078d4" }}>{s.table}</strong>
                </td>
                <td style={{ color: "#605e5c" }}>{s.desc}</td>
                <td style={{ fontFamily: "Consolas, monospace", fontSize: 11 }}>{s.keyFields}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type PlaygroundTab = "lessons" | "library" | "operators" | "schema";

const TABS: { key: PlaygroundTab; label: string }[] = [
  { key: "lessons", label: "15 lessons" },
  { key: "library", label: "Query library (40+)" },
  { key: "operators", label: "Operator reference" },
  { key: "schema", label: "Schema browser" },
];

export function KqlPlaygroundPage() {
  const [tab, setTab] = useState<PlaygroundTab>("lessons");

  return (
    <div>
      <div className={styles.h2}>KQL Playground</div>
      <p className={styles.sub}>Learn Kusto Query Language from zero. 15 lessons + operator reference + schema browser.</p>

      <SubTabBar tabs={TABS} active={tab} onChange={(key) => setTab(key as PlaygroundTab)} />

      {tab === "lessons" ? <LessonsSection /> : null}
      {tab === "library" ? <LibrarySection /> : null}
      {tab === "operators" ? <OperatorsSection /> : null}
      {tab === "schema" ? <SchemaSection /> : null}
    </div>
  );
}
