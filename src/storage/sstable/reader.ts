/*
reader is a module that provides a function to read key-value pairs from an SSTable file.
The readFromSSTable function takes a file path and a key as input, and returns the corresponding value if the key exists in the SSTable.
It first checks for the existence of a Bloom filter file associated with the SSTable. If the Bloom filter indicates that the key is not present, it returns undefined.
If the Bloom filter indicates that the key may be present, it reads through the SSTable file line by line, parsing each line as a JSON object and checking for a matching key.
If a match is found, it returns the associated value; otherwise, it returns undefined.
*/

import * as fs from "fs";
import { BloomFilter } from "../bloomfilter";

const bloomCache = new Map<string, BloomFilter>();

const dataCache = new Map<string, Map<string, string | null>>();

// invalidate the cache for a given SSTable file and its associated Bloom filter
function loadBloom(filePath: string): BloomFilter | undefined {
  if (bloomCache.has(filePath)) return bloomCache.get(filePath);

  // check if the Bloom filter file exists for the given SSTable file
  const bloomPath = filePath + ".bloom";
  if (!fs.existsSync(bloomPath)) return undefined;

  // read the Bloom filter from the file, deserialize it, and store it in the cache
  const filter = BloomFilter.deserialize(fs.readFileSync(bloomPath, "utf-8"));
  bloomCache.set(filePath, filter);
  return filter;
}

function loadData(filePath: string): Map<string, string | null> {
  const cached = dataCache.get(filePath);
  if (cached) return cached;

  // read the SSTable file line by line, parse each line as JSON, and store the key-value pairs in a Map
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
  const map = new Map<string, string | null>();
  for (const line of lines) {
    const entry = JSON.parse(line);

    if (!map.has(entry.key)) map.set(entry.key, entry.value);
  }

  dataCache.set(filePath, map);
  return map;
}

// read a key-value pair from an SSTable file, using the Bloom filter to optimize the search
export function readFromSSTable(filePath: string, key: string): string | null | undefined {
  const filter = loadBloom(filePath);
  if (filter && !filter.contains(key)) return undefined;

  const data = loadData(filePath);
  return data.has(key) ? data.get(key) : undefined;
}

// invalidate the cache for a given SSTable file and its associated Bloom filter
export function invalidateCache(filePath: string): void {
  bloomCache.delete(filePath);
  dataCache.delete(filePath);
}