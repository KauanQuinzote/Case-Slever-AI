import { z } from "zod";

export const ClientSchema = z.object({
  clients: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      prompt: z.string(),
    })
  ),
});
