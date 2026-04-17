# Configuração de Provedores de IA

Este projeto agora suporta múltiplos provedores de IA para o chat. O sistema detecta automaticamente qual provedor usar baseado em variáveis de ambiente.

## 🔄 Ordem de Prioridade

O sistema tenta usar provedores nesta ordem (primeira chave configurada vence):

1. **Lovable** (gateway que suporta Gemini, OpenAI, etc)
2. **Google Gemini** (API direta)
3. **OpenAI** (GPT-4, GPT-4o, etc)
4. **Groq** (LLaMA, Mixtral - super rápido)
5. **Anthropic Claude** (modelos Claude)

## 📋 Configuração por Provedor

### 1️⃣ **Lovable** (Recomendado se você já tem)

**Variável de Ambiente:**
```env
LOVABLE_API_KEY=sua_chave_aqui
```

**Onde obter:** https://www.lovable.dev  
**Modelos disponíveis:** Gemini, GPT-4, Claude, etc  
**Vantagem:** Gateway único, escolha o modelo que quiser  
**Documentação:** https://docs.lovable.dev

---

### 2️⃣ **Google Gemini** (Simples + Grátis)

**Variável de Ambiente:**
```env
GOOGLE_GEMINI_API_KEY=sua_chave_aqui
```

**Onde obter:**
1. Acesse https://aistudio.google.com
2. Clique em "Get API Key"
3. Crie um novo projeto ou selecione um existente
4. Copie a chave gerada

**Modelos suportados:**
- `gemini-2.5-flash` (recomendado)
- `gemini-2.5-pro`
- `gemini-1.5-flash`
- `gemini-1.5-pro`

**Vantagem:** Grátis até 15 req/min, ótima qualidade  
**Documentação:** https://ai.google.dev/docs

---

### 3️⃣ **OpenAI (ChatGPT)**

**Variável de Ambiente:**
```env
OPENAI_API_KEY=sk-...
```

**Onde obter:**
1. Acesse https://platform.openai.com/account/api-keys
2. Clique "Create new secret key"
3. Copie a chave

**Modelos suportados:**
- `gpt-4o-mini` (recomendado - rápido + barato)
- `gpt-4o`
- `gpt-4-turbo`
- `gpt-4`

**Custo:** $0.001-0.01 USD por request  
**Documentação:** https://platform.openai.com/docs

---

### 4️⃣ **Groq** (Rápido + Barato)

**Variável de Ambiente:**
```env
GROQ_API_KEY=gsk_...
```

**Onde obter:**
1. Acesse https://console.groq.com
2. Crie uma conta
3. Vá para API Keys
4. Gere uma nova chave

**Modelos suportados:**
- `mixtral-8x7b-32768` (recomendado)
- `llama-2-70b-chat`
- `llama2-7b-chat`

**Vantagem:** Resposta em ~100ms, ultra barato ($0.0001/1k tokens)  
**Documentação:** https://console.groq.com/docs

---

### 5️⃣ **Anthropic Claude**

**Variável de Ambiente:**
```env
ANTHROPIC_API_KEY=sk-ant-...
```

**Onde obter:**
1. Acesse https://console.anthropic.com
2. Crie uma conta
3. Vá para API Keys
4. Gere uma nova chave

**Modelos suportados:**
- `claude-3-5-sonnet-20241022` (recomendado)
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

**Vantagem:** Melhor reasoning, excelente qualidade  
**Custo:** $0.003-0.03 USD por request  
**Documentação:** https://docs.anthropic.com

---

## 🚀 Configurando no Supabase (Production)

Para **Edge Functions** rodando no Supabase:

1. Acesse seu **Supabase Dashboard**
2. Vá para **Settings** → **Functions** → **Secrets**
3. Clique **New Secret**
4. Adicione **UMA** destas chaves (ou mais, se quiser fallback):
   - `LOVABLE_API_KEY`
   - `GOOGLE_GEMINI_API_KEY`
   - `OPENAI_API_KEY`
   - `GROQ_API_KEY`
   - `ANTHROPIC_API_KEY`

**Exemplo com Groq (mais barato):**
```
GROQ_API_KEY=gsk_your_key_here
```

**Exemplo com Gemini (grátis):**
```
GOOGLE_GEMINI_API_KEY=AIzaSy...
```

---

## 💻 Configurando Local (Desenvolvimento)

Crie o arquivo `.env.local` na pasta `supabase/functions/`:

**`supabase/functions/.env.local`**
```env
# Escolha UMA (primeira configurada será usada)
GROQ_API_KEY=gsk_...
# LOVABLE_API_KEY=...
# GOOGLE_GEMINI_API_KEY=AIzaSy...
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
```

Depois rode:
```bash
supabase functions serve
```

**⚠️ IMPORTANTE:** Adicione `.env.local` ao `.gitignore` para não commitar chaves secretas!

```bash
echo "supabase/functions/.env.local" >> .gitignore
```

---

## 🧪 Testando a Configuração

Quando você fizer uma chamada ao chat, nos logs você verá:

```
[lead-search-ai-chat] Usando provider: gemini
```

ou

```
[followup-ai-chat] Usando provider: groq
```

Se nenhum provider estiver configurado, você verá:

```
Nenhuma chave de IA configurada. Configure uma de: LOVABLE_API_KEY, GOOGLE_GEMINI_API_KEY, ...
```

---

## 💡 Recomendação por Caso

| Caso | Provider | Motivo |
|------|----------|--------|
| **Já tem Lovable** | Lovable | Sem mudar nada |
| **Começando agora** | Gemini | Grátis + bom |
| **Melhor qualidade** | Claude | Melhor reasoning |
| **Chat muito rápido** | Groq | ~100ms resposta |
| **Aplicação production** | OpenAI | Confiável, escalável |

---

## 🔧 Se der erro...

**"Chave inválida"**
```
Chave de API inválida ou créditos insuficientes. (401)
```
→ Verifique se a chave está correta e tem créditos/quota

**"Limite de requisições"**
```
Limite de requisições excedido. (429)
```
→ Aguarde alguns segundos e tente novamente. Considere usar Groq (limite maior).

**"Nenhuma chave configurada"**
```
Nenhuma chave de IA configurada...
```
→ Configure pelo menos UMA variável de ambiente listada acima.

---

## 📚 Funções que usam IA

As seguintes funções Edge agora usam detecção automática:

- `lead-search-ai-chat` — Chat para busca de leads
- `followup-ai-chat` — Chat para sequências de follow-up

Ambas usam o mesmo sistema de detecção, então você só precisa configurar UMA chave!
