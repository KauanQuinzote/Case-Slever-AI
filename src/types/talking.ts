export type ConversationRole = "seller" | "client";

export type ConversationMessage = {
  role: ConversationRole;
  message: string;
};

export type ConversationMetadata = {
  totalMessages: number;
  sellerMessages: number;
  clientMessages: number;
};

export type ConversationResult = {
  conversation: ConversationMessage[];
  metadata: ConversationMetadata;
};

export type HiddenClient = {
  name: string;
  description: string;
  prompt: string;
};

export type HiddenClientsFile = {
  clients: HiddenClient[];
};

export type ConversationPerClient = {
  clientName: string;
  clientDescription: string;
  result?: ConversationResult;
  error?: string;
};

export type ConversationsFileOutput = {
  conversations: ConversationPerClient[];
  totals: {
    hiddenClientsProcessed: number;
    totalMessages: number;
    totalSellerMessages: number;
    totalClientMessages: number;
  };
};

