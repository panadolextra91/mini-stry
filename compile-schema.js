import Ajv from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";
import fs from "fs";
import schema from "./src/modules/runtime/schema/policy-content.schema.json" with { type: "json" };

const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true, code: { source: true, esm: true } });
const validate = ajv.compile(schema);
let moduleCode = standaloneCode(ajv, validate);
fs.writeFileSync("./src/modules/runtime/adapters/ajv/compiled-schema.js", moduleCode);
