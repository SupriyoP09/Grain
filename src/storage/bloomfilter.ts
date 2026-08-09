/*
bloomfilter is a probabilistic data structure that is used to test whether an element is a member of a set. 
It can return false positives, but it will never return false negatives. 
This means that if the Bloom filter says that an element is not in the set, then it definitely is not in the set. 
However, if it says that an element is in the set, there is a chance that it may not be.
The Bloom filter is space-efficient and can be used to reduce the amount of memory needed to store a large set of data.
*/

export class BloomFilter {
    private bits: Uint8Array; // the bit array that represents the Bloom filter
    private size: number; // size of the Bloom filter in bits
    private numHashes: number; // number of hash functions to use

    constructor(size: number = 1024, numHashes: number = 3) {
        this.size = size;
        this.numHashes = numHashes;
        this.bits = new Uint8Array(size);
    }

    // polynomial rolling hash function to generate multiple hash values for a given key
    // the hash function takes a key and a seed value,
    // and returns a hash value that is used to set or check bits in the Bloom filter
    // the seed value is used to generate different hash values for the same key
    private hash(key: string, seed: number): number {
        let h = seed;
        for (let i = 0; i < key.length; i++) {
            h = (h * 31 + key.charCodeAt(i)) >>> 0;
        }
        return h % this.size;
    }

    // adds a key to the Bloom filter by setting the bits at the positions determined by the hash functions
    add(key: string): void {
        for (let i = 0; i < this.numHashes; i++) {
            this.bits[this.hash(key, i)] = 1;
        }
    }

    // checks if a key is in the Bloom filter by checking the bits at the positions determined by the hash functions
    contains(key: string): boolean {
        for (let i = 0; i < this.numHashes; i++) {
            if (this.bits[this.hash(key, i)] === 0) return false;
            }
            return true;
        }

        // it serializes the Bloom filter to a string representation that can be stored or transmitted.
        serialize(): string {
            return JSON.stringify([...this.bits]);
        }
        
        // it deserializes a string representation of a Bloom filter back into a BloomFilter object.
        static deserialize(data: string, numHashes = 3): BloomFilter {
            const bits = JSON.parse(data) as number[];
            const filter = new BloomFilter(bits.length, numHashes);
            filter.bits = new Uint8Array(bits);
            return filter;
        }

}