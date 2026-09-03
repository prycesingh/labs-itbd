import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [cols] = await conn.execute(`SHOW COLUMNS FROM interview_module_capabilities`);
console.log("COLS:", cols.map(c => c.Field).join(", "));
await conn.end();
