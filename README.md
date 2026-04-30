# Agent Tester - Gerador de Clientes Ocultos

Gerador automatizado de personas de clientes ocultos para testar a resiliência, o tom de voz e o cumprimento de regras de negócio de agentes de vendas baseados em IA. O sistema utiliza técnicas de meta-prompting para garantir que os leads simulados apresentem comportamentos diversos e imprevisíveis.

## 📋 Tecnologias Utilizadas

- **TypeScript / Node.js** — Ambiente de execução e linguagem principal
- **Vercel AI SDK** — Framework para integração padronizada com múltiplos provedores de LLM
- **Zod** — Definição de esquemas e validação de saída estruturada (JSON)
- **Groq (Llama 3.3 70B)** — Provedor principal para geração de alta velocidade
- **Google Gemini 1.5 Flash** — Provedor de fallback para garantir disponibilidade

## 📁 Arquitetura de Pastas

```
Case-Slever-AI/
├── src/
│   ├── main.ts                 # Fluxo principal e geração de clientes ocultos
│   ├── talking.ts              # Simulação de conversas entre vendedor e cliente
│   ├── constants/
│   │   ├── main.ts             # Constantes para geração de clientes
│   │   └── talking.ts          # Constantes para simulação de conversas
│   ├── types/
│   │   └── talking.ts          # Definições de tipos TypeScript
│   └── main.test.ts            # Testes unitários
├── data/
│   ├── inputs/
│   │   ├── meta-prompt.txt     # Template do meta-prompt para geração de clientes
│   │   └── agent-prompt.txt    # Prompt do agente vendedor
│   ├── results/
│   │   ├── clientes_ocultos.json      # Clientes gerados
│   │   └── talking-output.json        # Saída das conversas simuladas
│   ├── zod.ts                  # Esquemas Zod para validação
│   └── zod.d.ts                # Tipos gerados do Zod
├── dist/                       # Código compilado (gerado)
├── .env.example                # Template de variáveis de ambiente
├── package.json                # Dependências do projeto
└── tsconfig.json               # Configuração do TypeScript
```

### Descrição dos Diretórios

- **`src/`** — Código-fonte TypeScript
  - `main.ts` — Orquestra o fluxo completo: gera clientes ocultos e dispara simulações
  - `talking.ts` — Gerencia conversas entre agente vendedor e clientes simulados
  - `constants/` — Centraliza paths, modelos de IA e limites de retry
  - `types/` — Interfaces e tipos TypeScript para type safety

- **`data/`** — Artefatos de entrada e saída
  - `inputs/` — Prompts e configurações estáticas
  - `results/` — Outputs JSON para análise posterior

## 🚀 Quick Start

### 1. Configurar Variáveis de Ambiente

```bash
cp .env.example .env
```

Editar `.env` com suas chaves de API:

```env
# Google Gemini API Key (Fallback Provider)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here

# Groq API Key (Primary Provider)
GROQ_API_KEY=your_groq_api_key_here
```

> **Onde obter as chaves:**
> - Groq: https://console.groq.com/keys
> - Google Gemini: https://ai.google.dev/gemini-api/docs/quickstart

### 2. Instalar Dependências

```bash
npm install
```

### 3. Executar o Pipeline Completo

```bash
npm run dev
```

Outputs gerados em:
- `data/results/clientes_ocultos.json` — Personas de clientes
- `data/results/talking-output.json` — Transcrições de conversas

## 🔄 Estrutura do Fluxo

```
┌─────────────────────────────────────┐
│  1. Geração de Clientes Ocultos    │
│     (Meta-Prompt + LLM)            │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  2. Simulação de Conversas          │
│     (Vendedor ↔ Cliente)            │
└────────────────┬────────────────────┘
                 │
                 ▼
          JSON Output
   (Análise & Validação)
```

## 🎯 Melhorias Implementadas (Entrega 4)

### 1. Matriz de Comportamento Dinâmica

**Problema:** IAs de geração tendem a criar personas lineares (ex: apenas um cliente "bravo").

**Solução:** O meta-prompt instrui o modelo a selecionar e combinar aleatoriamente de 2 a 3 características de uma lista de 18 situações distintas, incluindo:
- Objeções de preço
- Erros gramaticais
- Tentativas de engenharia social
- Impaciência
- Comparativo de mercado

**Resultado:** Leads mais complexos e realistas, testando múltiplas capacidades do agente simultaneamente.

### 2. Estratégia de Fallback (Graceful Degradation)

**Problema:** APIs de LLM podem apresentar instabilidades, rate limiting ou timeouts.

**Solução:** Implementação de camada de redundância com dois provedores:

```
Groq (Primário)
       ↓
   [Falha?]
       ↓
Google Gemini (Fallback)
       ↓
   [Sucesso/Falha]
```

**Benefícios:**
- Elimina pontos únicos de falha
- Garante continuidade em CI/CD
- Suporta automações de larga escala
- Retry automático com backoff exponencial

### 3. Tratamento Robusto de Erros

Cada simulação de conversa:
- Trata falhas isoladamente (não interrompe outras)
- Registra erro no JSON final com detalhes
- Permite análise parcial mesmo com falhas

Exemplo de saída com erro:
```json
{
  "conversations": [
    {
      "clientName": "Cliente A",
      "clientDescription": "...",
      "result": { /* conversa simulada */ }
    },
    {
      "clientName": "Cliente B",
      "clientDescription": "...",
      "error": "Quota exceeded after 3 retries"
    }
  ],
  "totals": { /* apenas sucessos */ }
}
```

## 📊 Configuração e Parâmetros

Editar `src/constants/` para ajustar:

### `main.ts`
- `DEFAULT_LEADS_TO_GENERATE` — Número de personas a gerar (padrão: 5)
- `GOOGLE_MODEL_ID` — Modelo Google (padrão: gemini-2.5-flash)
- `HIDDEN_CLIENTS_OUTPUT_PATH` — Onde salvar clientes gerados

### `talking.ts`
- `DEFAULT_MAX_CLIENTS_TO_PROCESS` — Quantos clientes simular (padrão: 1)
- `MAX_MESSAGES` — Máximo de turnos por conversa (padrão: 10)
- `REQUEST_INTERVAL_MS` — Delay entre requisições (padrão: 1000ms)
- `MAX_QUOTA_RETRIES` — Tentativas em caso de quota (padrão: 3)
- `GROQ_MODEL_ID` — Modelo Groq (padrão: llama-3.3-70b-versatile)

## 🛠️ Scripts Disponíveis

```bash
# Desenvolvimento (com tsx - sem compilação)
npm run dev

# Build TypeScript
npm run build

# Executar código compilado
npm run start

# Testes (se configurado)
npm test
```

## 🔒 Segurança

- ✅ Variáveis de ambiente em `.env` (nunca commitar)
- ✅ API keys protegidas via `dotenv`
- ✅ TypeScript para type safety
- ✅ Validação de schemas com Zod

## 📝 Exemplo de Saída

### Clientes Gerados (`clientes_ocultos.json`)
```json
{
  "clients": [
    {
      "name": "Carlos Silva",
      "description": "Gerente de TI, 8 anos de experiência, avesso a risco",
      "prompt": "Você é um cliente que..."
    }
  ]
}
```

### Conversas Simuladas (`talking-output.json`)
```json
{
  "conversations": [
    {
      "clientName": "Carlos Silva",
      "clientDescription": "...",
      "result": {
        "conversation": [
          { "role": "seller", "message": "Olá! Como posso ajudar?" },
          { "role": "client", "message": "Preciso de uma solução..." }
        ],
        "metadata": {
          "totalMessages": 10,
          "sellerMessages": 5,
          "clientMessages": 5
        }
      }
    }
  ],
  "totals": {
    "hiddenClientsProcessed": 1,
    "totalMessages": 10,
    "totalSellerMessages": 5,
    "totalClientMessages": 5
  }
}
```

## 🐛 Troubleshooting

| Erro | Solução |
|------|---------|
| `API key ausente` | Verificar `.env` e chaves válidas |
| `Quota exceeded` | Aguardar reset diário ou upgrade de plano |
| `JSON parsing error` | Validar formato dos prompts em `data/inputs/` |
| `Cannot read properties of undefined` | Verificar estrutura do arquivo JSON de clientes |

## 📚 Referências

- [Vercel AI SDK Docs](https://sdk.vercel.ai)
- [Groq API Docs](https://console.groq.com/docs)
- [Google Gemini API](https://ai.google.dev/gemini-api)
- [Zod Documentation](https://zod.dev)

---

**Versão:** 4.0  
**Status:** Produção  
**Última atualização:** 2026-04-30
