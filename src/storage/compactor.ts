/*
compactor is responsible for compacting the data files in the storage system.
It reads the existing data files, merges them, and writes the compacted data back to disk in a more efficient format.
This helps to reduce storage space and improve read performance by minimizing the number of files that need to be accessed during queries.
*/

import * as fs from 'fs';
import * as path from 'path';
import { Manifest } from '../manifest/manifest';
import { flushToSSTable } from './sstable/writer';

type Entry = {
  key: string;
  value: string | null;
};

function readAllEntries(filePath: string): Entry[] {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  return lines.map((line) =>JSON.parse(line));
}

// compact & merge the data files in the storage system
export function compact(dataDir: string, manifest: Manifest): void {
  const files = manifest.listNewestFiles();
  if (files.length < 2 ) return;

  const merged = new Map<string, string | null>();
  for (const file of files) {
    const entries = readAllEntries(path.join(dataDir, file));
    for (const { key, value} of entries) {
      if (!merged.has(key)) merged.set(key, value);
    }
  }

  // sort the merged entries by key and filter out any entries with null values
  const finalEntries = [...merged.entries()]
    .filter(([, value]) => value !== null)
    .sort(([a], [b]) => a.localeCompare(b));

    const newFile = `sstable-compacted-${Date.now()}.log`; // a new file name for the compacted data
    flushToSSTable(finalEntries, path.join(dataDir, newFile)); // the compacted data to a new SSTable file

    // delete the old files and their corresponding bloom filter files
    for (const file of files) {
      fs.unlinkSync(path.join(dataDir, file));
      const bloomFile = path.join(dataDir, file + '.bloom');
      if (fs.existsSync(bloomFile)) fs.unlinkSync(bloomFile);
    }
    manifest.replaceFiles(files, [newFile]); // update the manifest to reflect the new compacted file
}