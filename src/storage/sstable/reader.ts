/*
reader is a module that provides a function to read key-value pairs from an SSTable file.
The readFromSSTable function takes a file path and a key as input, and returns the corresponding value if the key exists in the SSTable.
It first checks for the existence of a Bloom filter file associated with the SSTable. If the Bloom filter indicates that the key is not present, it returns undefined.
If the Bloom filter indicates that the key may be present, it reads through the SSTable file line by line, parsing each line as a JSON object and checking for a matching key.
If a match is found, it returns the associated value; otherwise, it returns undefined.
*/

import * as fs from "fs";
import { BloomFilter } from "../bloomfilter";

export function readFromSSTable(filePath: string, key: string): string | null | undefined {
  const bloomPath = filePath + ".bloom";
  if (fs.existsSync(bloomPath)) {
    const filter = BloomFilter.deserialize(fs.readFileSync(bloomPath, "utf-8"));
    if (!filter.contains(key)) return undefined;
  }

  const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
  for (const line of lines) {
    const entry = JSON.parse(line);
    if (entry.key === key) return entry.value;
  }
  return undefined;
}