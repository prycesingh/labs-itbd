import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [answers] = await conn.execute(
  `SELECT id, audio_storage_path, audio_mime_type FROM candidate_interview_answers WHERE session_id = ?`,
  ['f3c89211-c051-45c9-aea3-8a12e832cfe1']
);
console.log(JSON.stringify(answers, null, 2));
await conn.end();
