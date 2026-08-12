import { Engine } from "../src/engine";
import * as fs from "fs";
import * as path from "path";

const TEST_DIR = path.join(__dirname, "test-data"); // Directory for test data

function setup(): void {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

// Simple assertion function for testing
function assertEqual(actual: unknown, expected: unknown, label: string): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "✅" : "❌"} ${label}`);
  if (!pass) console.log(`   expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`);
}

// Test for basic set and get operations
function testBasicSetGet(): void {
  const db = new Engine(TEST_DIR);
  db.set("name", "supriyo");
  assertEqual(db.get("name"), "supriyo", "basic set/get");
}

// Test for delete operation and tombstone handling
function testDeleteTombstone(): void {
  const db = new Engine(TEST_DIR);
  db.set("temp", "value");
  db.delete("temp");
  assertEqual(db.get("temp"), null, "delete returns null, not stale value");
}

// Test for missing key returns null
function testMissingKey(): void {
  const db = new Engine(TEST_DIR);
  assertEqual(db.get("does-not-exist"), null, "missing key returns null");
}

// Test for flushing data to SSTable
function testFlushToSSTable(): void {
  const db = new Engine(TEST_DIR);
  for (let i = 0; i < 500; i++) {
    db.set(`key-${i}`, `value-${i}-${"x".repeat(20)}`);
  }
  assertEqual(db.get("key-0"), "value-0-" + "x".repeat(20), "value survives flush to SSTable");
}

// Test for crash recovery using Write-Ahead Log (WAL)
function testCrashRecovery(): void {
  const db1 = new Engine(TEST_DIR);
  db1.set("recovered-key", "recovered-value");
  const db2 = new Engine(TEST_DIR); // simulates a process restart
  assertEqual(db2.get("recovered-key"), "recovered-value", "WAL replay recovers unflushed writes");
}

function run(): void {
  console.log("Starting Grain Engine Tests...\n");

  setup();
  testBasicSetGet();

  setup();
  testDeleteTombstone();

  setup();
  testMissingKey();

  setup();
  testFlushToSSTable();

  setup();
  testCrashRecovery();

  console.log("\n All tests completed!");
}

run();