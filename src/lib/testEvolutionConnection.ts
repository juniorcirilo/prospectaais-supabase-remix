import { supabase } from "@/integrations/supabase/client";

interface TestEvolutionConnectionResponse {
  ok: boolean;
  message: string;
  count?: number;
}

export async function testEvolutionConnection(apiUrl?: string, apiKey?: string) {
  const { data, error } = await supabase.functions.invoke<TestEvolutionConnectionResponse>("test-evolution-connection", {
    body: {
      api_url: apiUrl?.trim() || undefined,
      api_key: apiKey?.trim() || undefined,
    },
  });

  if (error) {
    throw new Error(error.message || "Falha ao testar conexão");
  }

  if (!data?.ok) {
    throw new Error(data?.message || "Falha ao conectar com a Evolution API");
  }

  return data;
}