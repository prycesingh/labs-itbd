import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const sessionId = "f3c89211-c051-45c9-aea3-8a12e832cfe1";
const interviewCoachModuleId = "bfe21c60-d2a4-45f6-9d14-28d92245a239";

const [caps] = await conn.execute(
  `SELECT module_id, capability_key, enabled, config FROM interview_module_capabilities WHERE module_id = ?`,
  [interviewCoachModuleId],
);
console.log("INTERVIEW COACH CAPABILITIES:", JSON.stringify(caps, null, 2));

const [answers] = await conn.execute(
  `SELECT id FROM candidate_interview_answers WHERE session_id = ?`,
  [sessionId],
);
const answerIds = answers.map((a) => a.id);
console.log("ANSWER IDS:", answerIds);

const [dmCols] = await conn.execute(`SHOW COLUMNS FROM interview_delivery_metrics`);
console.log("DELIVERY METRICS COLS:", dmCols.map((c) => c.Field).join(", "));

if (answerIds.length > 0) {
  const placeholders = answerIds.map(() => "?").join(",");
  const [metrics] = await conn.execute(
    `SELECT * FROM interview_delivery_metrics WHERE answerId IN (${placeholders})`,
    answerIds,
  );
  console.log("DELIVERY METRICS ROWS:", JSON.stringify(metrics, null, 2));
}

await conn.end();
