import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const answerIds = [
  '767e0c49-a3ae-4862-84ff-503bbfb3a50a',
  'a11b1b6e-1ab8-442b-beaa-3dbec2b61440',
  '73de08b0-d140-44bf-904c-db8f0a8fc839',
  '530a7be7-9923-4051-b595-407f8ea5cc7c',
  '961c32ce-3183-4d99-ba4c-a3f015101bb3'
];
const placeholders = answerIds.map(() => "?").join(",");
const [metrics] = await conn.execute(
  `SELECT * FROM interview_delivery_metrics WHERE answer_id IN (${placeholders})`,
  answerIds,
);
console.log("DELIVERY METRICS ROWS:", JSON.stringify(metrics, null, 2));
await conn.end();
