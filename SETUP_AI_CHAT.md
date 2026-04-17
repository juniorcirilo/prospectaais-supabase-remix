# 🚀 Setup Rápido - Ativar AI Chat

Seu erro: **"LOVABLE_API_KEY is not configured"** → significa que nenhuma chave de IA está configurada.

## ⚡ Opção Mais Rápida (Recomendado)

### 1. Pegar Chave Groq (GRÁTIS)

```
1. Acesse: https://console.groq.com
2. Login/Signup (rápido, suporta Google)
3. Vá para "API Keys"
4. Click "Create API Key"
5. Copie a chave (começa com "gsk_")
```

### 2. Configurar Localmente

**Arquivo: `.env.local`** (crie este arquivo na raiz do projeto)

```env
GROQ_API_KEY=gsk_sua_chave_aqui
```

### 3. Reiniciar Servidor

```bash
# Interrompa o servidor (Ctrl+C)
supabase functions serve
```

### 4. Testar

- Vá para Dashboard → Lead Search
- Digite uma descrição: "CTOs de startups em São Paulo"
- Click "Enviar"
- Deve funcionar! ✅

---

## 📋 Comparação de Opções

| Provider | Custo | Setup | Velocidade | Qualidade |
|----------|-------|-------|-----------|-----------|
| **Groq** | 💰 Grátis | ⚡ 1 min | 🚀 Rápido | ✅ Boa |
| Gemini | 💰 Grátis | ⚡ 1 min | ✅ Normal | ✅ Boa |
| OpenAI | 💵 $0.01-0.03 | ⚡ 2 min | ✅ Normal | ⭐ Melhor |
| Lovable | 💵 Pago | ⚡ 5 min | ✅ Normal | ✅ Boa |
| Anthropic | 💵 $0.003-0.03 | ⚡ 2 min | ✅ Normal | ⭐ Excelente |

**Recomendação**: Comece com **Groq** (grátis + rápido). Se quiser melhor qualidade, mude para **OpenAI** ou **Anthropic** depois.

---

## 🔧 Outras Opções

### Gemini (Google - Também Grátis)

```
1. Acesse: https://aistudio.google.com
2. Click "Get API Key"
3. Copie a chave (começa com "AIzaSy")
4. Em .env.local: GEMINI_API_KEY=AIzaSy...
```

### OpenAI (Padrão - $5-20/mês com créditos)

```
1. Acesse: https://platform.openai.com
2. Vá para API Keys
3. Click "Create new secret key"
4. Em .env.local: OPENAI_API_KEY=sk-...
```

---

## ⚠️ Arquivos Importantes

- `.env.local` ← Configure aqui as chaves (NÃO commite no git!)
- `.env.local.example` ← Template de exemplo
- `supabase/functions/_shared/ai-providers.ts` ← Lógica de detecção

---

## 🔐 Para Produção (Supabase Cloud)

Depois que testar localmente e funcionar:

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Settings → Secrets
4. Click "Add secret"
5. Name: `GROQ_API_KEY`, Value: sua chave
6. Click "Deploy"

Pronto! O app vai usar a chave do Supabase automaticamente.

---

## 📞 Se Não Funcionar

**Erro: "Nenhuma chave de IA configurada"**
- ✅ Verifique `.env.local` existe
- ✅ Verifique nome da chave está correto (GROQ_API_KEY, não GROQ_KEY)
- ✅ Reinicie `supabase functions serve`

**Erro: "Chave inválida"**
- ✅ Verifique se copiou a chave completa
- ✅ Verifique se a chave é válida (teste em https://console.groq.com)

**Chat ainda não funciona**
- ✅ Verifique F12 Console para ver erro exato
- ✅ Veja os logs: `supabase functions serve --no-verify-jwt`
