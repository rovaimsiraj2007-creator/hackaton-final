// import dotenv from "dotenv";
// import bcrypt from "bcrypt";
// import { pool } from "./db.js";

// dotenv.config();

// const email = "admin@example.com";

// try {
//   const result = await pool.query(
//     "SELECT password_hash FROM users WHERE email = LOWER($1)",
//     [email]
//   );

//   if (result.rows.length === 0) {
//     console.log("Admin account not found.");
//   } else {
//     const hash = result.rows[0].password_hash;

//     console.log("Admin account found.");
//     console.log("Hash length:", hash.length);

//     const password = await import("node:readline/promises");
//     const terminal = password.createInterface({
//       input: process.stdin,
//       output: process.stdout,
//     });

//     const enteredPassword = await terminal.question(
//       "Admin setup wala password enter karo (input hidden nahi hoga): "
//     );

//     terminal.close();

//     const matches = await bcrypt.compare(enteredPassword, hash);
//     console.log("Password matches database:", matches);
//   }
// } catch (error) {
//   console.error("Check failed:", error.message);
// } finally {
//   await pool.end();
// }