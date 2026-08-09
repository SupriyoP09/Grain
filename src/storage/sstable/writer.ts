/*
writer is a module that provides a function to flush key-value entries to an SSTable file and create a corresponding Bloom filter for efficient membership testing. 
The flushToSSTable function takes an array of entries and a file path, writes the entries to the specified file in JSON format,
and generates a Bloom filter that is saved to a separate file with a .bloom extension. 
This allows for quick checks of whether a key may exist in the SSTable without having to read the entire file.
*/

import * as fs from "fs";
import { BloomFilter } from "../bloomfilter";

export function flushToSSTable(
    entries: [string, string | null][],
    filePath: string,
): void {
    const lines = entries.map(([k, v]) => JSON.stringify({key: k, value: v}));
    fs.writeFileSync(filePath, lines.join("\n") + "\n");

    const filter = new BloomFilter();
    for (const [key] of entries) filter.add(key);
    fs.writeFileSync(filePath + ".bloom", filter.serialize());
}