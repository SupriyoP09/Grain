import * as fs from "fs";

// Define the type for write-ahead log operations
type WalOp = {type: "SET", key: string, value: string} | {type: "DELETE", key: string};

// handle write-ahead log operations
export class Wal {
    private fd: number; // File descriptor for the WAL file

    constructor(private path: string) {
        this.fd = fs.openSync(path, "a"); // Open the file in append mode
    }

    // if the process crashes, this file is only record of what happened
    append(op: WalOp): void {
        const line = JSON.stringify(op) + "\n"; // Convert the operation to a JSON string and add a newline
        fs.writeSync(this.fd, line); // Write the line to the WAL file
        fs.fsyncSync(this.fd); // Ensure the data is flushed to disk
    }

    // replaying the log file to recover the state of the database
    static replay(path: string): WalOp[] {
        if (!fs.existsSync(path)) return []; // If the WAL file does not exist, return an empty array
        const content = fs.readFileSync(path, "utf-8"); // Read the content of the WAL file as a string
        return content.split("\n").filter(Boolean).map(line => JSON.parse(line) as WalOp); // Parse each line as a WalOp and return the array of operations
    }

    clear(): void {
        fs.closeSync(this.fd); // Close the file descriptor
        fs.writeFileSync(this.path, ""); // Clear the contents of the WAL file by writing an empty string
        this.fd = fs.openSync(this.path, "a"); // Reopen the file in append mode
    }
}