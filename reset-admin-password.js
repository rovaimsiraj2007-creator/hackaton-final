
// import dotenv from "dotenv";
// import bcrypt from "bcrypt";
// import { pool } from "./db.js";
// import readline from "node:readline/promises";
// import { stdin, stdout } from "node:process";

// dotenv.config();

// const terminal = readline.createInterface({
//   input: stdin,
//   output: stdout,
// });

// try {
//   const email = "admin@example.com";
//   const password = await terminal.question(
//     "Naya Admin password enter karo (minimum 8 characters): "
//   );

//   if (password.length < 8) {
//     throw new Error("Password kam az kam 8 characters ka hona chahiye.");
//   }

//   const passwordHash = await bcrypt.hash(password, 12);

//   const result = await pool.query(
//     `UPDATE users
//      SET password_hash = $1,
//          is_active = TRUE,
//          must_change_password = FALSE
//      WHERE email = LOWER($2)
//        AND role = 'admin'
//      RETURNING id, email, role`,
//     [passwordHash, email]
//   );

//   if (result.rowCount === 0) {
//     console.log("Admin account nahi mila. Koi record update nahi hua.");
//   } else {
//     console.log("Admin password reset successful.");
//     console.log("Email:", result.rows[0].email);
//     console.log("Role:", result.rows[0].role);
//   }
// } catch (error) {
//   console.error("Reset failed:", error.message);
// } finally {
//   terminal.close();
//   await pool.end();
// }
