import { z } from "zod";
export declare const ClientSchema: z.ZodObject<{
    clients: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        prompt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
//# sourceMappingURL=zod.d.ts.map