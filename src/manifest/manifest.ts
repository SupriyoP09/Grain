import * as fs from "fs";

export class Manifest {
    private files: string[] = [];

    constructor(private path: string) {
        if (!fs.existsSync(path)) {
            this.files = JSON.parse(fs.readFileSync(path, "utf-8"));
        }
    }

    // Add a new file to the manifest and persist the changes
    addFile(filePath: string): void {
        this.files.unshift(filePath);
        this.persist();
    }

    listNewestFiles(): string[] {
        return this.files;
    }

    // Replace old files with new files in the manifest and persist the changes
    replaceFiles(oldFiles: string[], newFiles: string[]): void {
        this.files = this.files.filter((f) => !oldFiles.includes(f));
        this.files.unshift(...newFiles);
        this.persist();
    }

    // Persist the current state of the manifest to the file system
    private persist(): void {
        fs.writeFileSync(this.path, JSON.stringify(this.files));
    }
}