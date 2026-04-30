import fs from "node:fs/promises";
import path from "node:path";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import "dotenv/config";
import {
  DEFAULT_AGENT_PROMPT_PATH,
  DEFAULT_HIDDEN_CLIENTS_PATH,
  DEFAULT_MAX_CLIENTS_TO_PROCESS,
  DEFAULT_STARTER_MESSAGE,
  DEFAULT_TALKING_OUTPUT_PATH,
  GOOGLE_MODEL_ID,
  GROQ_MODEL_ID,
  MAX_MESSAGES,
  MAX_QUOTA_RETRIES,
  QUOTA_RETRY_BUFFER_MS,
  REQUEST_INTERVAL_MS,
} from "./constants/talking";
import type {
  ConversationMessage,
  ConversationMetadata,
  ConversationPerClient,
  ConversationResult,
  ConversationRole,
  ConversationsFileOutput,
  HiddenClientsFile,
} from "./types/talking";

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

function oppositeRole(role: ConversationRole): ConversationRole {
  return role === "seller" ? "client" : "seller";
}

function toMetadata(conversation: ConversationMessage[]): ConversationMetadata {
  const sellerMessages = conversation.filter(
    (entry) => entry.role === "seller"
  ).length;
  const clientMessages = conversation.length - sellerMessages;

  return {
    totalMessages: conversation.length,
    sellerMessages,
    clientMessages,
  };
}

function buildTurnPrompt(
  rolePrompt: string,
  role: ConversationRole,
  conversation: ConversationMessage[]
): string {
  const history = conversation
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.message}`)
    .join("\n");

  return [
    rolePrompt,
    "",
    `Você está atuando como ${role === "seller" ? "vendedor" : "cliente"}.`,
    "Continue a conversa abaixo com apenas UMA mensagem curta.",
    "Não adicione marcações de papel (ex: 'seller:'), nem explicações.",
    "",
    "Histórico:",
    history,
    "",
    "Próxima mensagem:",
  ].join("\n");
}

async function generateRoleMessage(
  rolePrompt: string,
  role: ConversationRole,
  conversation: ConversationMessage[]
): Promise<string> {
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!googleApiKey && !groqApiKey) {
    throw new Error(
      "API keys ausentes. Defina GOOGLE_GENERATIVE_AI_API_KEY ou GROQ_API_KEY no arquivo .env."
    );
  }

  const prompt = buildTurnPrompt(rolePrompt, role, conversation);
  const googleModel = google(GOOGLE_MODEL_ID);
  const groqModel = groq(GROQ_MODEL_ID);

  for (let attempt = 1; attempt <= MAX_QUOTA_RETRIES; attempt += 1) {
    try {
      if (!googleApiKey) {
        throw new Error("Google API key ausente.");
      }

      const response = await generateText({
        model: googleModel,
        prompt,
        temperature: 0.7,
      });

      return response.text.trim();
    } catch (error) {
      if (groqApiKey) {
        console.warn("Falha ao gerar com Google. Tentando fallback com Groq...");

        const fallbackResponse = await generateText({
          model: groqModel,
          prompt,
          temperature: 0.7,
        });

        return fallbackResponse.text.trim();
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

  throw new Error("Falha inesperada ao gerar mensagem.");
}

export async function simulateConversation(
  sellerPrompt: string,
  clientPrompt: string,
  starter: ConversationRole,
  initialMessage: string
): Promise<ConversationResult> {
  const conversation: ConversationMessage[] = [
    {
      role: starter,
      message: initialMessage,
    },
  ];

  while (conversation.length < MAX_MESSAGES) {
    const nextRole = oppositeRole(conversation[conversation.length - 1]!.role);
    const rolePrompt = nextRole === "seller" ? sellerPrompt : clientPrompt;
    const nextMessage = await generateRoleMessage(rolePrompt, nextRole, conversation);

    conversation.push({
      role: nextRole,
      message: nextMessage,
    });

    if (conversation.length < MAX_MESSAGES) {
      await wait(REQUEST_INTERVAL_MS);
    }
  }

  return {
    conversation,
    metadata: toMetadata(conversation),
  };
}

export async function simulateConversationsForHiddenClients(
  agentPromptPath = DEFAULT_AGENT_PROMPT_PATH,
  hiddenClientsPath = DEFAULT_HIDDEN_CLIENTS_PATH,
  outputPath = DEFAULT_TALKING_OUTPUT_PATH,
  starter: ConversationRole = "seller",
  initialMessage = DEFAULT_STARTER_MESSAGE,
  maxClientsToProcess = DEFAULT_MAX_CLIENTS_TO_PROCESS
): Promise<ConversationsFileOutput> {
  const sellerPrompt = await fs.readFile(agentPromptPath, "utf8");
  const hiddenClientsRaw = await fs.readFile(hiddenClientsPath, "utf8");
  const hiddenClientsData = JSON.parse(hiddenClientsRaw);

  let clients: HiddenClient[];
  if (Array.isArray(hiddenClientsData)) {
    clients = hiddenClientsData;
  } else if (hiddenClientsData.clients && Array.isArray(hiddenClientsData.clients)) {
    clients = hiddenClientsData.clients;
  } else {
    throw new Error(
      `Formato inválido do arquivo de clientes. Esperado: {clients: [...]} ou [...], recebido: ${JSON.stringify(
        hiddenClientsData
      ).substring(0, 200)}`
    );
  }

  const conversations: ConversationPerClient[] = [];
  let totalMessages = 0;
  let totalSellerMessages = 0;
  let totalClientMessages = 0;

  const selectedClients = clients.slice(0, Math.max(0, maxClientsToProcess));

  for (const hiddenClient of selectedClients) {
    try {
      const result = await simulateConversation(
        sellerPrompt,
        hiddenClient.prompt,
        starter,
        initialMessage
      );

      totalMessages += result.metadata.totalMessages;
      totalSellerMessages += result.metadata.sellerMessages;
      totalClientMessages += result.metadata.clientMessages;

      conversations.push({
        clientName: hiddenClient.name,
        clientDescription: hiddenClient.description,
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Erro ao simular conversa para ${hiddenClient.name}:`, errorMessage);

      conversations.push({
        clientName: hiddenClient.name,
        clientDescription: hiddenClient.description,
        error: errorMessage,
      });
    }
  }

  const output: ConversationsFileOutput = {
    conversations,
    totals: {
      hiddenClientsProcessed: conversations.length,
      totalMessages,
      totalSellerMessages,
      totalClientMessages,
    },
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));

  return output;
}

if (require.main === module) {
  simulateConversationsForHiddenClients()
    .then((output) => {
      console.log("Conversas geradas com sucesso.");
      console.log("Totais:", output.totals);
      console.log("Teste executado com 1 cliente oculto.");
      console.log("Arquivo salvo em data/results/talking-output.json");
    })
    .catch((error: unknown) => {
      console.error("Erro ao gerar conversas:", error);
      process.exitCode = 1;
    });
}
