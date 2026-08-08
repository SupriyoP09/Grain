export class Memtable {
    private store: Map<string, string | null> = new Map();
    private sizeBytes = 0;

    // sets a key-value pair in the memtable and updates the size in bytes
    set(key: string, value: string): void {
        this.store.set(key, value);
        this.sizeBytes += key.length + value.length;
    }

    // tombstones a key in the memtable by setting its value to null
    delete(key: string): void {
        this.store.set(key, null);
    }

    // retrieves the value associated with a key in the memtable,
    // returning null if the key is tombstoned or undefined if the key does not exist
    get(key: string): string | null | undefined {
        return this.store.get(key);
    }

    // returns the current size of the memtable in bytes
    size(): number {
        return this.sizeBytes;
    }

    // returns an array of key-value pairs in the memtable, sorted by key in alphabetical order
    entries(): [string, string | null][] {
        return [...this.store.entries()].sort(([a], [b]) => a.localeCompare(b));
    }

    // clears the memtable and resets the size in bytes
    clear(): void {
        this.store.clear();
        this.sizeBytes = 0;
    }
}