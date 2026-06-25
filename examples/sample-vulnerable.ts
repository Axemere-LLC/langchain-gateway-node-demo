// Sample file intentionally containing security, performance, and style issues.
// Use this as a quick test input: make review FILE=examples/sample-vulnerable.ts

import { execSync } from "child_process";
import * as fs from "fs";

// Hardcoded secret — classic security finding
const DB_PASSWORD = "super_secret_password_123";

interface User {
  id: number;
  name: string;
  role: any;  // weak typing
}

// N+1 query pattern — performance finding
async function getUsersWithOrders(db: any, userIds: number[]): Promise<any[]> {
  const results = [];
  for (const id of userIds) {
    const user = await db.query(`SELECT * FROM users WHERE id = ${id}`);  // SQL injection
    const orders = await db.query("SELECT * FROM orders WHERE user_id = " + id);
    results.push({ user, orders });
  }
  return results;
}

// Command injection — security finding
function runReport(filename: string): string {
  return execSync(`cat reports/${filename}`).toString();
}

// Unbounded recursion — performance + correctness finding
function flatten(arr: any[]): any[] {
  let result: any[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      result = result.concat(flatten(item));  // concat in loop = O(n²)
    } else {
      result.push(item);
    }
  }
  return result;
}

// Swallowed error — style/correctness finding
function readConfig(path: string): object {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (e) {
    return {};  // silently returns empty config on any error
  }
}

// God function — style finding
function processUserRequest(userId: number, action: string, data: any, db: any, logger: any, cache: any) {
  logger.log("processing");
  const cached = cache.get(userId);
  if (cached) return cached;
  const user = db.findById(userId);
  if (!user) return null;
  if (action === "delete") {
    db.delete(userId);
    cache.clear();
    logger.log("deleted user " + userId);
  } else if (action === "update") {
    db.update(userId, data);
    cache.set(userId, data);
    logger.log("updated");
  }
  return db.findById(userId);
}
