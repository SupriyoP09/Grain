/*
engine is the main entry point for the database engine.
It is responsible for managing the memtable, WAL, and manifest,
as well as handling read and write operations.
in short means everythings wires together here
*/

import { Memtable } from "./memtable/memtable";
import { Wal } from "./wal/wal";
import { Manifest } from "./manifest/manifest";
import { flushToSSTable } from "./storage/sstable/writer";
import { readFromSSTable } from "./storage/sstable/reader";
import { compact } from "./storage/compactor";
import * as path from "path";

const FLUSH_THRESHOLD = 1000; // threshold for flushing the memtable to disk
const COMPACT_THRESHOLD = 4; // threshold for compacting the data files

export class Engine {
    private memtable = new Memtable();
    private wal: Wal;
    private manifest: Manifest;
    private dataDir: string;

    constructor(dataDir: string) {
        this.dataDir = dataDir;
        this.wal = new Wal(path.join(dataDir, "wal.log"));
        this.manifest = new Manifest(path.join(dataDir, "manifest.json"));
        this.recover(); // recover the state from the WAL and manifest
    }

    // recover the state from the WAL and manifest
    private recover(): void {
        const ops = Wal.replay(path.join(this.dataDir, "wal.log"));
        for (const op of ops) {
            if (op.type === "SET") this.memtable.set(op.key, op.value);
            else this.memtable.delete(op.key);
        }
    }

    // set a key-value pair in the database
    set(key: string, value: string): void {
        this.wal.append({ type: "SET", key, value });
        this.memtable.set(key, value);
        if (this.memtable.size() >= FLUSH_THRESHOLD) this.flush();

    }

    // delete a key from the database
    delete(key: string): void {
        this.wal.append({ type: "DELETE", key });
        this.memtable.delete(key);
    }

    // get the value for a key from the database
    get(key: string): string | null | undefined {
        const inMem = this.memtable.get(key)
        if (inMem !== undefined) return inMem;

        // check the SSTables in the manifest for the key
        for (const file of this.manifest.listNewestFiles()) {
            const result = readFromSSTable(path.join(this.dataDir, file), key);
            if (result !== undefined) return result;
        }
        return null;
    }

    // flush the memtable to disk and clear the WAL
    private flush(): void {
        const filename = `sstable-${Date.now()}.log`;
        flushToSSTable(this.memtable.entries(), path.join(this.dataDir, filename));
        this.manifest.addFile(filename);
        this.memtable.clear();
        this.wal.clear();

        // compact the data files if the number of files exceeds the threshold
        if (this.manifest.listNewestFiles().length >= COMPACT_THRESHOLD) {
            compact(this.dataDir, this.manifest);
        }
    }

}