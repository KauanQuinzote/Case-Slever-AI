import { ClientSchema } from "../data/zod";
import fs from "node:fs/promises";
import path from "node:path";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { generateObject, generateText } from "ai";
import "dotenv/config";
import {
  AGENT_PROMPT_PATH,
  DEFAULT_LEADS_TO_GENERATE,
  GOOGLE_MODEL_ID,
  HIDDEN_CLIENTS_OUTPUT_PATH,
  META_PROMPT_PATH,
} from "./constants/main";
import { simulateConversationsForHiddenClients } from "./talking";
import { GROQ_MODEL_ID, MAX_QUOTA_RETRIES, QUOTA_RETRY_BUFFER_MS } from "./constants/talking";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("quota exceeded") ||
    message.includes("resource_exhausted") ||
    message.includes("status code: 429")
  );
}

function extractRetryDelayMs(error: unknown): number | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const secondsMatch = error.message.match(/Please retry in ([\d.]+)s/i);
  if (secondsMatch) {
    const seconds = Number(secondsMatch[1]);
    if (!Number.isNaN(seconds)) {
      return Math.ceil(seconds * 1000);
    }
  }

  const millisMatch = error.message.match(/Please retry in ([\d.]+)ms/i);
  if (millisMatch) {
    const millis = Number(millisMatch[1]);
    if (!Number.isNaN(millis)) {
      return Math.ceil(millis);
    }
  }

  return null;
}

function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1];
  }
  return text.trim();
}

export async function gerarClientesOcultos(
  numberOfLeads: number = DEFAULT_LEADS_TO_GENERATE
) {
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!googleApiKey && !groqApiKey) {
    throw new Error(
      "API keys ausentes. Defina GOOGLE_GENERATIVE_AI_API_KEY ou GROQ_API_KEY no arquivo .env."
    );
  }

  const salesAgentPrompt = await fs.readFile(AGENT_PROMPT_PATH, "utf8");
  const metaPromptTemplate = await fs.readFile(META_PROMPT_PATH, "utf8");
  const metaPrompt = metaPromptTemplate
    .replace("{{numberOfLeads}}", String(numberOfLeads))
    .replace("{{salesAgentPrompt}}", salesAgentPrompt);

  const googleModel = google(GOOGLE_MODEL_ID);
  const groqModel = groq(GROQ_MODEL_ID);

  for (let attempt = 1; attempt <= MAX_QUOTA_RETRIES; attempt += 1) {
    try {
      if (!googleApiKey) {
        throw new Error("Google API key ausente.");
      }

      const response = await generateObject({
        model: googleModel,
        schema: ClientSchema,
        prompt: metaPrompt,
      });

      const clientesGerados = response.object;
      const outputPath = HIDDEN_CLIENTS_OUTPUT_PATH;
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(clientesGerados, null, 2));
      return;
    } catch (error) {
      if (groqApiKey) {
        console.warn("Falha ao gerar com Google. Tentando fallback com Groq...");

        try {
          const groqPrompt = metaPrompt + "\n\nResponda APENAS com um JSON válido, sem explicações ou markdown.";
          const fallbackResponse = await generateText({
            model: groqModel,
            prompt: groqPrompt,
          });

          const jsonText = extractJSON(fallbackResponse.text);
          const clientesGerados = JSON.parse(jsonText);
          const outputPath = HIDDEN_CLIENTS_OUTPUT_PATH;
          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          await fs.writeFile(
            outputPath,
            JSON.stringify(clientesGerados, null, 2)
          );
          return;
        } catch (groqError) {
          console.error("Falha também ao tentar com Groq:", groqError);
          throw groqError;
        }
      }

      if (!isQuotaError(error) || attempt === MAX_QUOTA_RETRIES || !googleApiKey) {
        throw error;
      }

      const retryDelayMs = extractRetryDelayMs(error) ?? 60_000;
      const waitTimeMs = retryDelayMs + QUOTA_RETRY_BUFFER_MS;

      console.warn(
        `Quota atingida. Aguardando ${Math.ceil(waitTimeMs / 1000)}s antes de tentar novamente...`
      );
      await wait(waitTimeMs);
    }
  }

  throw new Error("Falha inesperada ao gerar clientes ocultos.");
}

async function runMainFlow(): Promise<void> {
  await gerarClientesOcultos();
  await simulateConversationsForHiddenClients();
}

if (require.main === module) {
  runMainFlow()
    .then(() => {
      console.log("Fluxo concluido: clientes ocultos + simulacao de conversas.");
    })
    .catch((error: unknown) => {
      console.error("Erro ao executar fluxo principal:", error);
      process.exitCode = 1;
    });
}