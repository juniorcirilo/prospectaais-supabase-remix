# Guia de Deploy - test-ai-provider

## Problema

Você está vendo erros CORS ao testar a conexão com provedores de IA no dashboard.

## Solução

A função `test-ai-provider` precisa ser deployada no Supabase.

### Option 1: Deploy via CLI (Recomendado)

```bash
# Certifique-se que está no diretório do projeto
cd /srv/sites/prospectaais-supabase-remix

# Link ao projeto Supabase (se não estiver linkado)
supabase link --project-ref frtxacxypyntcfgeaqnx

# Deploy a função específica
supabase functions deploy test-ai-provider

# Ou deploy todas as funções
supabase functions deploy
```

### Option 2: Via Dashboard Supabase

1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá para "Edge Functions" > "test-ai-provider"
4. Copie o código de `supabase/functions/test-ai-provider/index.ts`
5. Cole no editor e salve

### Option 3: Via Git Push (se configurado)

```bash
git add supabase/functions/test-ai-provider/
git commit -m "Add test-ai-provider function"
git push origin main
# O Supabase fará deploy automático se configurado
```

## Verificação

Após deploy, teste acessando no navegador (deve retornar erro de auth, não CORS):

```
https://frtxacxypyntcfgeaqnx.supabase.co/functions/v1/test-ai-provider
```

Deve retornar algo como:
```
{"success":false,"error":"Não autenticado"}
```

Se receber erro CORS, redeploye a função.

## Debug

Se ainda não funcionar:
1. Verifique se há erros em "Logs" no dashboard Supabase
2. Confirme que `supabase/functions/_shared/auth.ts` foi deployado
3. Tente redeployer tudo com `supabase functions deploy --no-verify-jwt`

## Próximos Passos

1. Deploy a função
2. Volte ao dashboard e teste "Testar Conexão"
3. Verifique os logs do browser (F12 > Console)
