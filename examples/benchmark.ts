import { Engine } from "../src/engine";
import * as fs from "fs";
import * as path from "path";

// Benchmarking Grain Engine performance
const BENCH_DIR = path.join(__dirname, "bench-data");
if (fs.existsSync(BENCH_DIR)) fs.rmSync(BENCH_DIR, { recursive: true, force: true });
fs.mkdirSync(BENCH_DIR, { recursive: true });

const db = new Engine(BENCH_DIR); // Initialize the database engine for benchmarking

const N = 10000; // Number of writes and reads for the benchmark

console.log(`Starting Benchmark: ${N} writes, ${N} reads...`);

// Benchmark write performance
const writeStart = performance.now();
for (let i = 0; i < N; i++) db.set(`key-${i}`, `value-${i}`);
const writeMs = performance.now() - writeStart;

// Benchmark read performance
const readStart = performance.now();
for (let i = 0; i < N; i++) {
  const idx = Math.floor(Math.random() * N);
  db.get(`key-${idx}`);
}
const readMs = performance.now() - readStart;

console.log(`✅ Wrote ${N} keys in ${writeMs.toFixed(2)}ms (${(N / (writeMs / 1000)).toFixed(0)} writes/sec)`);
console.log(`✅ Read ${N} keys in ${readMs.toFixed(2)}ms (${(N / (readMs / 1000)).toFixed(0)} reads/sec)`);