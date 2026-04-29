import { ClientSchema } from "../configurations/zod";
import fs from "node:fs/promises";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import "dotenv/config";

async function gerarClientesOcultos(numberOfLeads: number = 20) {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "API key ausente. Defina GOOGLE_GENERATIVE_AI_API_KEY (ou GEMINI_API_KEY) no arquivo .env."
    );
  }
  const salesAgentPrompt = await fs.readFile("agent-prompt.md", "utf8");
  const metaPromptTemplate = await fs.readFile(
    "configurations/meta-prompt.txt",
    "utf8"
  );
  const metaPrompt = metaPromptTemplate
    .replace("{{numberOfLeads}}", String(numberOfLeads))
    .replace("{{salesAgentPrompt}}", salesAgentPrompt);

  const model = google("gemini-2.5-flash", { apiKey });

  try {
  const response = await generateObject({
    model,
    schema: ClientSchema,
    prompt: metaPrompt
  });

  const clientesGerados = response.object;
  await fs.writeFile("clientes_ocultos.json", JSON.stringify(clientesGerados, null, 2));

  } catch (error) {
    console.error("Erro ao gerar clientes ocultos:", error);
    throw error;
  }
}

gerarClientesOcultos();