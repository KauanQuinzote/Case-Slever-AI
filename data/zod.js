"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientSchema = void 0;
const zod_1 = require("zod");
exports.ClientSchema = zod_1.z.object({
    clients: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        description: zod_1.z.string(),
        prompt: zod_1.z.string(),
    })),
});
//# sourceMappingURL=zod.js.map