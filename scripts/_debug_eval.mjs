import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [answers] = await conn.execute(
  `SELECT id, ai_evaluation_id, transcripted_text FROM candidate_interview_answers WHERE session_id = ? LIMIT 2`,
  ['f3c89211-c051-45c9-aea3-8a12e832cfe1']
);
console.log("ANSWERS:", JSON.stringify(answers, null, 2));

const evalIds = answers.map(a => a.ai_evaluation_id).filter(Boolean);
if (evalIds.length > 0) {
  const placeholders = evalIds.map(() => "?").join(",");
  const [evals] = await conn.execute(
    `SELECT id, evaluation_json_structured FROM ai_interview_evaluations WHERE id IN (${placeholders})`,
    evalIds
  );
  console.log("EVALUATIONS:", JSON.stringify(evals, null, 2));
}
await conn.end();
