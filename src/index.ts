import { Engine } from "./engine";

const db = new Engine("./data");
db.set("name", "supriyo");
db.set("lang", "typescript");
console.log(db.get("name")); // supriyo
db.delete("name");
console.log(db.get("name")); // null