/**
 * KQL playground seed data — extracted from the source itbd-lab static site
 * (kql-playground.html). Used by the one-time admin seed endpoint to
 * populate the labs KQL-playground queries table; not read directly at
 * request time.
 *
 * `level` matches the source's sidebar grouping: 'b' = Beginner,
 * 'i' = Intermediate, 'a' = Advanced.
 */

export type KqlPlaygroundQuerySeedEntry = {
  level: string;
  title: string;
  desc: string;
  kql: string;
  explain: string;
};

export const KQL_PLAYGROUND_QUERIES_SEED: KqlPlaygroundQuerySeedEntry[] = [
  // Beginner
  { "level": "b", "title": "List all sign-ins today",
    "desc": "The simplest query — show all rows from SigninLogs table.",
    "kql": "SigninLogs",
    "explain": "<h4>What this does</h4>Returns ALL rows from the SigninLogs table. In production, always add a time filter or you will scan months of data + run out of memory.<br><br><b>Production version:</b> <code>SigninLogs | where TimeGenerated > ago(24h)</code>" },
  { "level": "b", "title": "Filter failed sign-ins",
    "desc": "Use `where` to filter rows. ResultType != 0 means a failure.",
    "kql": "SigninLogs\n| where ResultType != 0",
    "explain": "<h4>What this does</h4><code>where</code> filters rows by condition. <code>ResultType != 0</code> excludes successful sign-ins (0 = success in Entra). Common error codes: 50053 = locked out, 50126 = invalid password." },
  { "level": "b", "title": "Project only columns I care about",
    "desc": "Use `project` to choose which columns appear.",
    "kql": "SigninLogs\n| project TimeGenerated, UserPrincipalName, Location, ResultType",
    "explain": "<h4>What this does</h4><code>project</code> selects columns. Reduces noise. Order matters — columns appear in the order specified." },
  { "level": "b", "title": "Sort results",
    "desc": "Most recent first using `order by`.",
    "kql": "SigninLogs\n| order by TimeGenerated desc",
    "explain": "<h4>What this does</h4><code>order by</code> sorts. <code>desc</code> = newest first. Same as <code>sort by</code> (KQL alias)." },
  { "level": "b", "title": "Take top N",
    "desc": "Show only first 5 rows.",
    "kql": "SigninLogs\n| order by TimeGenerated desc\n| take 5",
    "explain": "<h4>What this does</h4><code>take</code> returns N arbitrary rows (or N after sort, if combined). <code>top 5 by TimeGenerated</code> is equivalent + cleaner." },

  // Intermediate
  { "level": "i", "title": "Count failed sign-ins per user",
    "desc": "Aggregate with `summarize`.",
    "kql": "SigninLogs\n| where ResultType != 0\n| summarize FailedCount=count() by UserPrincipalName\n| order by FailedCount desc",
    "explain": "<h4>What this does</h4><code>summarize</code> groups + aggregates. <code>count()</code> counts rows per group. The \"by\" specifies the grouping column. <code>FailedCount=</code> names the new column." },
  { "level": "i", "title": "Time-series chart (hour buckets)",
    "desc": "Bucket events by hour, render as timechart.",
    "kql": "SigninLogs\n| summarize count() by bin(TimeGenerated, 1h)\n| render timechart",
    "explain": "<h4>What this does</h4><code>bin(TimeGenerated, 1h)</code> rounds the timestamp down to the nearest hour. Then we count per bucket. <code>render timechart</code> visualises. Note: render works in real Sentinel; not visualised here in the playground." },
  { "level": "i", "title": "Add a calculated column with `extend`",
    "desc": "Tag rows with a risk level based on result type.",
    "kql": "SigninLogs\n| extend Outcome = iff(ResultType == 0, \"Success\", \"Failure\")\n| project TimeGenerated, UserPrincipalName, Outcome, Location",
    "explain": "<h4>What this does</h4><code>extend</code> creates new columns. <code>iff(condition, ifTrue, ifFalse)</code> is the KQL ternary. Can chain multiple <code>extend</code>s." },
  { "level": "i", "title": "Filter by country",
    "desc": "Find sign-ins from non-India locations.",
    "kql": "SigninLogs\n| where Location !in (\"IN\", \"\")\n| project TimeGenerated, UserPrincipalName, IPAddress, Location, RiskLevelDuringSignIn",
    "explain": "<h4>What this does</h4><code>!in</code> checks if column is NOT in the supplied list. Empty string handles unmapped locations. Useful for geo-anomaly detection." },
  { "level": "i", "title": "Join two tables on user",
    "desc": "Correlate sign-ins with audit events for same user.",
    "kql": "SigninLogs\n| where TimeGenerated > ago(1d)\n| join kind=inner (\n    AuditLogs\n    | extend UserPrincipalName = tostring(InitiatedBy.user.userPrincipalName)\n) on UserPrincipalName\n| project TimeGenerated, UserPrincipalName, OperationName, Location",
    "explain": "<h4>What this does</h4><code>join kind=inner</code> returns only rows that exist in BOTH tables. <code>tostring()</code> handles dynamic JSON. Note: AuditLogs.InitiatedBy is JSON in real Sentinel." },
  { "level": "i", "title": "Top processes spawned by Outlook",
    "desc": "Common phishing kill-chain detection.",
    "kql": "DeviceProcessEvents\n| where InitiatingProcessFileName == \"outlook.exe\"\n| summarize Count=count() by FileName, AccountName\n| order by Count desc",
    "explain": "<h4>What this does</h4>Spawning powershell.exe / cmd.exe from outlook.exe is suspicious — often phishing → macro → script. This is a real Sentinel hunt query." },
  { "level": "i", "title": "Brute force pattern: multiple failed logins from same IP",
    "desc": "SecurityEvent 4625 grouped by source IP.",
    "kql": "SecurityEvent\n| where EventID == 4625\n| summarize FailedAttempts=count(), TargetAccounts=dcount(Account) by SourceIP\n| where FailedAttempts > 2",
    "explain": "<h4>What this does</h4><code>dcount(Account)</code> = distinct count of accounts targeted. <code>where FailedAttempts > 2</code> filters noisy 1-off failures. Real rule would tune to thousands per hour for password spray." },
  { "level": "i", "title": "Email subject keyword hunt",
    "desc": "Find phishing emails by suspicious keywords.",
    "kql": "EmailEvents\n| where Subject has_any (\"verify\", \"urgent\", \"wire transfer\", \"password expired\")\n| project Timestamp, Subject, SenderFromAddress, RecipientEmailAddress, DeliveryAction, ThreatTypes",
    "explain": "<h4>What this does</h4><code>has_any</code> does fast substring match against a list. Faster than multiple OR conditions. Case-insensitive by default." },
  { "level": "i", "title": "Sign-in risk: high or medium only",
    "desc": "Combine multiple where filters.",
    "kql": "SigninLogs\n| where RiskLevelDuringSignIn in (\"high\", \"medium\")\n| project TimeGenerated, UserPrincipalName, IPAddress, Location, RiskLevelDuringSignIn",
    "explain": "<h4>What this does</h4><code>in (...)</code> is exact-match list. Use for enum-like columns. For substring use <code>contains</code>." },
  { "level": "i", "title": "Count by App + DAU",
    "desc": "Daily active users per application.",
    "kql": "SigninLogs\n| summarize DAU=dcount(UserPrincipalName) by AppDisplayName, bin(TimeGenerated, 1d)\n| order by DAU desc",
    "explain": "<h4>What this does</h4><code>dcount</code> = distinct count. Combined with bin(1d) gives daily unique user count per app. Useful for adoption metrics." },

  // Advanced
  { "level": "a", "title": "Impossible travel detection",
    "desc": "Same user signing in from far-apart locations within 1 hour.",
    "kql": "SigninLogs\n| where ResultType == 0\n| sort by UserPrincipalName, TimeGenerated\n| extend PrevLocation = prev(Location), PrevTime = prev(TimeGenerated), PrevUser = prev(UserPrincipalName)\n| where UserPrincipalName == PrevUser and PrevLocation != Location and Location != \"\" and PrevLocation != \"\"\n| extend TimeDelta = datetime_diff(\"hour\", TimeGenerated, PrevTime)\n| where TimeDelta < 1\n| project TimeGenerated, UserPrincipalName, FromLoc=PrevLocation, ToLoc=Location, TimeDelta",
    "explain": "<h4>What this does</h4>Uses <code>prev()</code> window function to compare adjacent rows after sort. Flags users who appeared in 2 countries within 1 hour. Real impossible-travel rule uses geo-distance calc + VPN exclusions." },
  { "level": "a", "title": "Password spray hunt",
    "desc": "One IP attempting many accounts with few attempts each.",
    "kql": "SigninLogs\n| where ResultType in (50126, 50053)\n| summarize DistinctUsers=dcount(UserPrincipalName), TotalAttempts=count() by IPAddress\n| where DistinctUsers > 3 and TotalAttempts < 50",
    "explain": "<h4>What this does</h4>Classic password spray = many users, few attempts per user (vs brute force = 1 user, many attempts). DistinctUsers > 3 + TotalAttempts < 50 captures the pattern." },
  { "level": "a", "title": "Hunt for LSASS dump activity",
    "desc": "Find Mimikatz or similar tools accessing lsass.exe.",
    "kql": "DeviceProcessEvents\n| where ProcessCommandLine has_any (\"mimikatz\", \"sekurlsa\", \"logonpasswords\", \"lsass.dmp\")",
    "explain": "<h4>What this does</h4>Mimikatz + similar credential-theft tools leave fingerprints. Production rule: also check <code>DeviceFileEvents</code> for file creates matching \"*.dmp\" on lsass + <code>DeviceEvents</code> for ASR rule triggers." },
  { "level": "a", "title": "Find OAuth consent grants for risky apps",
    "desc": "AAD audit log entries for app consent.",
    "kql": "AuditLogs\n| where OperationName == \"Consent to application\"\n| project TimeGenerated, InitiatedBy, TargetResources, OperationName",
    "explain": "<h4>What this does</h4>OAuth consent phishing = malicious app gets user to consent to Mail.Read + offline_access. Detect by alerting on every consent grant + reviewing the requested scopes." },
  { "level": "a", "title": "Suspicious process chain: Outlook → PowerShell → ANY",
    "desc": "Macro execution → script → arbitrary command.",
    "kql": "let pscalls = DeviceProcessEvents\n    | where InitiatingProcessFileName == \"outlook.exe\"\n    | where FileName == \"powershell.exe\"\n    | project Timestamp, DeviceName, AccountName, ProcessCommandLine, PsId=tostring(ProcessId);\nDeviceProcessEvents\n| where InitiatingProcessFileName == \"powershell.exe\"\n| join pscalls on $left.InitiatingProcessId == $right.PsId, $left.DeviceName == $right.DeviceName\n| project ChainTime=Timestamp, DeviceName, AccountName, PowerShellCmd=ProcessCommandLine1, NextProcess=FileName, NextCmd=ProcessCommandLine",
    "explain": "<h4>What this does</h4>Builds a chain: Outlook → PowerShell → next process. Uses <code>let</code> to define the pscalls table, then joins. Real hunt also captures script content via Defender XDR DeviceProcessEvents extended fields." },
  { "level": "a", "title": "Auto-rotate Defender alert investigation",
    "desc": "Workbook query for SOC dashboard.",
    "kql": "SigninLogs\n| where TimeGenerated > ago(7d) and ResultType != 0\n| summarize count() by bin(TimeGenerated, 1h)\n| extend rolling_avg = series_decompose_forecast(count_, 24)\n| render timechart",
    "explain": "<h4>What this does</h4>Time-series decomposition + forecast. Helps spot anomalous spikes vs baseline. Real Sentinel uses this in Anomaly analytics rules." },
  { "level": "a", "title": "OAuth token replay (post-AiTM)",
    "desc": "Same token issued and replayed from different fingerprint.",
    "kql": "SigninLogs\n| where AuthenticationDetails has \"primary_refresh_token\"\n| project TimeGenerated, UserPrincipalName, IPAddress, DeviceDetail, UniqueTokenIdentifier=AuthenticationDetails",
    "explain": "<h4>What this does</h4>Real AiTM detection joins SigninLogs by sessionId + checks if device fingerprint changes within 1 hour. Microsoft has built-in \"Anomalous Token\" detection in Identity Protection." },
  { "level": "a", "title": "NRT (Near Real-Time) rule: Domain Admin added",
    "desc": "Detect anyone added to Domain Admins.",
    "kql": "IdentityDirectoryEvents\n| where ActionType == \"Group Membership changed\"\n| where TargetGroupDisplayName == \"Domain Admins\"\n| where AdditionalFields has \"Add\"\n| project Timestamp, ActorUPN=AccountUpn, TargetUPN=TargetAccountUpn, TargetGroup=TargetGroupDisplayName",
    "explain": "<h4>What this does</h4>Adding a user to Domain Admins is a Tier-0 event. NRT rule fires within 1 minute. Should be high severity. (IdentityDirectoryEvents is a Defender for Identity table in real Sentinel.)" },
  { "level": "a", "title": "Beaconing detection (low + slow traffic)",
    "desc": "Regular interval connections to same destination = C2 beacon.",
    "kql": "DeviceNetworkEvents\n| summarize Intervals=make_list(Timestamp) by RemoteUrl, DeviceName\n| extend IntervalDiff = array_iif(array_length(Intervals)>1, datetime_diff(\"second\", Intervals[1], Intervals[0]), 0)\n| where IntervalDiff > 300 and IntervalDiff < 600",
    "explain": "<h4>What this does</h4>Detects regular 5-10 minute intervals to the same URL — classic C2 beaconing. Real production rule uses standard deviation across intervals to spot consistent timing." },
  { "level": "a", "title": "Materialize for cross-table efficiency",
    "desc": "Cache expensive subqueries for reuse.",
    "kql": "let allFailed = materialize(\n    SigninLogs\n    | where ResultType != 0\n    | project UserPrincipalName, IPAddress, TimeGenerated\n);\nallFailed\n| summarize count() by UserPrincipalName\n| join (allFailed | summarize dcount(IPAddress) by UserPrincipalName) on UserPrincipalName",
    "explain": "<h4>What this does</h4><code>materialize()</code> caches results of an expensive sub-query. Reuse the same data across multiple joins/summarizes without re-scanning. Saves a lot in production where SigninLogs has billions of rows." }
];
