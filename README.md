```
  ____ ____      _    ___ _   _ 
 / ___|  _ \    / \  |_ _| \ | |
| |  _| |_) |  / _ \  | ||  \| |
| |_| |  _ <  / ___ \ | || |\  |
 \____|_| \_\/_/   \_\___|_| \_|

LSM-Tree Key-Value storage engine
```

A small, functional Log-Structured Merge (LSM) Tree key-value storage engine, built from scratch in TypeScript.

Grain implements a complete storage lifecycle directly against the file system with zero external database dependencies. It features an in-memory write buffer, a Write-Ahead Log for crash recovery, immutable SSTables, Bloom filters for fast negative lookups, and background compaction.

This project was built to understand, at the implementation level, how modern key-value stores manage writes, durability, and disk storage.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Write Path](#write-path)
- [Read Path](#read-path)
- [Crash Recovery](#crash-recovery)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Tests](#tests)
- [Benchmarks](#benchmarks)
- [Design Decisions](#design-decisions)
- [Known Limitations and Future Work](#known-limitations-and-future-work)
- [License](#license)

---

## Features

| Component | Description |
|---|---|
| MemTable | In-memory sorted write buffer backed by a `Map`, holding the most recent writes |
| Write-Ahead Log (WAL) | Append-only log written before every mutation, with `fsync` batched via group commit for durability at high write throughput |
| SSTables | Immutable, sorted on-disk segment files produced when the MemTable is flushed |
| Bloom Filter | Per-SSTable probabilistic filter that lets reads skip files that cannot contain a key |
| Manifest | Tracks which SSTable files currently exist, newest first |
| Compactor | Merges SSTable files once a threshold is reached, dropping tombstoned keys |
| In-memory read cache | Caches parsed SSTable contents and Bloom filters per file to avoid redundant disk reads |
| Crash recovery | Replays the WAL on startup to rebuild any MemTable state lost before a flush |

---

## Architecture

Grain follows the standard LSM-tree write/read split:

- **Writes** always go to the WAL first (durability), then to the MemTable (speed). Once the MemTable crosses a size threshold, it is flushed to an immutable SSTable file on disk, and the WAL is cleared.
- **Reads** check the MemTable first (freshest data), then fall back to SSTable files on disk, newest to oldest. A Bloom filter is checked before opening each file, so files that cannot contain the key are skipped without a disk read.
- **Compaction** runs automatically once enough SSTable files accumulate, merging them into a single file and permanently removing deleted (tombstoned) keys.

---

## Write Path

```mermaid
flowchart LR
    A[Client calls db.set / db.delete] --> B[Wal.append<br/>durable write, fsync]
    B --> C[Memtable.set / delete]
    C --> D{Memtable size<br/>>= 1000 bytes?}
    D -- No --> E[Done]
    D -- Yes --> F[flushToSSTable<br/>+ build Bloom filter]
    F --> G[Manifest.addFile]
    G --> H[Wal.clear]
    H --> I{4+ SSTable<br/>files?}
    I -- No --> E
    I -- Yes --> J[Compactor merges files<br/>drops tombstones]
    J --> K[Manifest.replaceFiles]
```

Every write is appended to the WAL before the in-memory MemTable is touched, so the file always contains a durable, ordered record of what happened. Rather than calling `fsync` after every single append, the WAL batches this via group commit: it tracks pending unsynced writes and forces a physical disk sync every 256 operations, or immediately whenever the WAL is cleared after a flush. This preserves the same ordering guarantee that makes crash recovery correct, while removing the per-write `fsync` cost that was capping write throughput — see [Benchmarks](#benchmarks).

---

## Read Path

```mermaid
flowchart LR
    A[Client calls db.get] --> B{Key in<br/>Memtable?}
    B -- Yes --> R[Return value / null]
    B -- No --> C[Check SSTables<br/>newest to oldest]
    C --> D{Bloom filter<br/>says might contain?}
    D -- No --> C
    D -- Yes --> E[Look up key in<br/>cached SSTable data]
    E --> F{Found?}
    F -- Yes --> R
    F -- No --> C
    C -- all files exhausted --> G[Return null]
```

`readFromSSTable` first checks an in-memory-cached Bloom filter for the file. If the filter reports the key is definitely absent, the file is skipped with no disk access. Otherwise, the file's parsed contents (also cached after first access) are checked directly. This cache is what turned Grain's read throughput from roughly 96 reads/sec to over 126,000 reads/sec — see [Benchmarks](#benchmarks).

---

## Crash Recovery

```mermaid
flowchart LR
    A[Engine starts] --> B[Wal.replay]
    B --> C[Rebuild Memtable<br/>from logged SET/DELETE ops]
```

On startup, the `Engine` constructor replays every operation in `wal.log` back into the MemTable before accepting new requests. Any writes that were `fsync`ed but never flushed to an SSTable are recovered this way.

---

## Project Structure

```
grain/
├── src/
│   ├── memtable/
│   │   └── memtable.ts        in-memory sorted map, tombstone deletes
│   ├── wal/
│   │   └── wal.ts              append-only write-ahead log, replay on startup
│   ├── manifest/
│   │   └── manifest.ts         tracks active SSTable files
│   ├── storage/
│   │   ├── sstable/
│   │   │   ├── writer.ts       flush Memtable to disk + build Bloom filter
│   │   │   └── reader.ts       cached SSTable + Bloom filter lookups
│   │   ├── bloomfilter.ts      probabilistic membership filter
│   │   └── compactor.ts        merges SSTables, drops tombstones
│   ├── engine.ts                public API — wires everything together
│   └── index.ts                  entry point / demo
├── examples/
│   ├── exampletest.ts           correctness tests
│   └── benchmark.ts             write/read throughput benchmark
├── data/                          WAL, SSTable, and manifest files (generated at runtime)
├── package.json
├── tsconfig.json
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm

### Installation

```bash
git clone https://github.com/SupriyoP09/Grain.git
cd Grain
npm install
```

### Run

```bash
npx tsx src/index.ts
```

Expected output:

```
supriyo
null
```

The second line is `null` because the demo script deletes the `name` key immediately after reading it.

---

## Tests

Grain includes a small correctness suite covering the core guarantees of an LSM-tree engine: basic reads/writes, tombstone deletes, flush-to-disk durability, and WAL-based crash recovery.

```bash
npx tsx examples/exampletest.ts
```

```
Starting Grain Engine Tests...

✅ basic set/get
✅ delete returns null, not stale value
✅ missing key returns null
✅ value survives flush to SSTable
✅ WAL replay recovers unflushed writes

All tests completed!
```

---

## Benchmarks

```bash
npx tsx examples/benchmark.ts
```

Benchmark: 10,000 writes followed by 10,000 random-key reads, measured across three stages of the engine's development.

| Stage | Writes/sec | Reads/sec |
|---|---|---|
| Baseline | 601 | 96 |
| + in-memory read cache | 583 | 126,875 |
| + WAL group commit | 8,615 | 285,281 |

**Why the read cache changed reads but not writes:** the original `readFromSSTable` re-read and re-parsed both the `.bloom` file and the full SSTable file from disk on every single call, even for files it had already read moments earlier. An in-memory cache (keyed by file path, invalidated on compaction) ensures each SSTable file and its Bloom filter are read from disk once, with all subsequent lookups served from memory — a ~1,322x improvement. Writes were untouched at this stage since the bottleneck there was unrelated to reads.

**Why group commit improved writes by roughly 14x:** every write originally called `fsync` individually, which blocks until the OS confirms the WAL entry is physically on disk — the real, unavoidable cost of per-write durability. Group commit batches this: `fsync` is called once every 256 pending writes (or immediately on flush), so most writes only pay the cost of a fast in-memory/OS-buffered append. Reads improved further in this stage too, largely due to less contention on the WAL file descriptor during the benchmark's write phase.

**The durability tradeoff, stated plainly:** group commit does not weaken crash recovery against a process crash — Node's `fs.writeSync` hands data to the OS immediately, so a crashed process still leaves those writes in the WAL file for `WAL.replay` to recover. What it does trade away is protection against power loss or an OS-level crash within an unsynced batch: in the worst case, up to 255 writes that were acknowledged but not yet `fsync`ed could be lost if the machine loses power before the next batch boundary. This is a standard, well-understood tradeoff made by most production databases in exchange for write throughput, not an oversight.

---

## Design Decisions

- **WAL before MemTable, always.** Every `set`/`delete` writes to the WAL before touching the in-memory store, so the log always reflects operations in the order they happened.
- **Group commit over per-write fsync.** `fsync` is batched every 256 pending writes rather than called on every single one, trading a bounded window of power-loss durability for a roughly 14x improvement in write throughput — see [Benchmarks](#benchmarks) for the measured impact and the exact tradeoff.
- **Tombstones over immediate deletion.** Deletes are recorded as `null` values rather than removed outright, so a delete correctly overrides an older value already flushed to an SSTable. Tombstones are only dropped permanently during compaction, once no older file can "resurrect" the key.
- **JSON Lines on-disk format.** SSTables and the WAL use newline-delimited JSON rather than a binary format. This trades some space and parse efficiency for readability and simplicity, which was the right tradeoff for a project focused on the LSM-tree mechanics rather than serialization performance.
- **Bloom filter per SSTable file.** Each flushed SSTable gets its own Bloom filter, avoiding a disk read entirely for files that cannot contain a given key.
- **In-memory caching over disk re-reads.** SSTable contents and Bloom filters are cached per file path after first access, since files are immutable once written — the only time a cache entry becomes stale is when compaction deletes the file, which explicitly invalidates the cache.

---

## Known Limitations and Future Work

- **Fixed group commit interval.** The WAL syncs every 256 writes regardless of workload; this is not configurable, and there is no time-based fallback (e.g. "sync every 10ms even if fewer than 256 writes have queued"), which a production system would need to bound worst-case data loss under low write volume.
- **No binary serialization.** SSTables and the WAL are stored as JSON Lines. A binary format with a fixed-size header, checksums, and a block index would reduce file size and parsing cost.
- **No sparse index or binary search.** SSTable lookups scan a fully parsed in-memory map rather than using a sparse index over sorted, block-based data — sufficient at the scale this engine is tested at, but not how production LSM engines handle very large files.
- **No range queries.** Only exact-key `get`/`set`/`delete` are supported; no iteration over key ranges.
- **Single-process only.** Grain is an embedded engine, not a server — there is no network protocol, concurrent client support, or replication. This is an intentional scope boundary, not a missing feature: those concerns belong in a separate, larger project.

---

## License

MIT — see [LICENSE](LICENSE) for details.