import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBrazilianPhone(raw: string): string[] {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return [];
  
  const variants: string[] = [];
  
  if (digits.length === 11) {
    // Already has 9th digit
    variants.push("55" + digits);
    // Also try without the 9th digit
    const without9 = digits.slice(0, 2) + digits.slice(3);
    variants.push("55" + without9);
  } else if (digits.length === 10) {
    // Without 9th digit — add it
    const ddd = digits.slice(0, 2);
    const number = digits.slice(2);
    variants.push("55" + ddd + "9" + number);
    // Also try without
    variants.push("55" + digits);
  }
  
  return variants;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instance_id, numbers } = await req.json();

    if (!instance_id || !numbers?.length) {
      return new Response(JSON.stringify({ error: "instance_id and numbers are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: instance } = await supabase
      .from("whatsapp_instances").select("instance_name").eq("id", instance_id).single();

    if (!instance) {
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: secrets } = await supabase
      .from("whatsapp_instance_secrets").select("api_url, api_key").eq("instance_id", instance_id).single();

    if (!secrets) {
      return new Response(JSON.stringify({ error: "Instance secrets not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const CHUNK_SIZE = 50;

    // Build list: for each input number, get all variants to try
    // Keep original index to map back correctly
    const entries: Array<{ original: string; variants: string[]; originalIndex: number }> = [];
    for (let idx = 0; idx < numbers.length; idx++) {
      const raw = numbers[idx];
      const variants = normalizeBrazilianPhone(raw);
      if (variants.length > 0) {
        entries.push({ original: raw, variants, originalIndex: idx });
      }
    }

    // Collect all unique variants to check in one batch
    const allVariants: string[] = [];
    const variantMap: Map<string, number> = new Map(); // variant -> entry index
    
    for (let i = 0; i < entries.length; i++) {
      for (const v of entries[i].variants) {
        if (!variantMap.has(v)) {
          allVariants.push(v);
          variantMap.set(v, i);
        }
      }
    }

    console.log(`[validate] ${numbers.length} inputs -> ${entries.length} valid -> ${allVariants.length} variants to check`);

    // Check all variants in chunks
    const variantResults = new Map<string, { exists: boolean; jid: string | null }>();

    for (let i = 0; i < allVariants.length; i += CHUNK_SIZE) {
      const chunk = allVariants.slice(i, i + CHUNK_SIZE);
      try {
        const url = `${secrets.api_url}/chat/whatsappNumbers/${instance.instance_name}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { apikey: secrets.api_key, "Content-Type": "application/json" },
          body: JSON.stringify({ numbers: chunk }),
        });

        if (!response.ok) {
          console.error(`[validate] API returned ${response.status} for chunk starting at ${i}`);
          continue;
        }

        const data = await response.json();
        const apiResults = Array.isArray(data) ? data : [];

        for (let j = 0; j < chunk.length && j < apiResults.length; j++) {
          const apiResult = apiResults[j];
          const exists = apiResult?.exists ?? apiResult?.numberExists ?? false;
          variantResults.set(chunk[j], { exists, jid: apiResult?.jid || null });
        }
      } catch (err) {
        console.error(`[validate] Chunk error:`, err);
      }

      if (i + CHUNK_SIZE < allVariants.length) await delay(500);
    }

    // Map back: for each entry, check if ANY variant was valid
    const results: Array<{ phone: string; exists: boolean; jid: string | null; originalIndex: number; originalPhone: string }> = [];
    for (const entry of entries) {
      let found = false;
      for (const v of entry.variants) {
        const r = variantResults.get(v);
        if (r?.exists) {
          results.push({ phone: v, exists: true, jid: r.jid, originalIndex: entry.originalIndex, originalPhone: entry.original });
          found = true;
          break;
        }
      }
      if (!found) {
        results.push({ phone: entry.variants[0], exists: false, jid: null, originalIndex: entry.originalIndex, originalPhone: entry.original });
      }
    }

    console.log(`[validate] Results: ${results.filter(r => r.exists).length} valid, ${results.filter(r => !r.exists).length} invalid`);

    return new Response(JSON.stringify({
      results,
      validCount: results.filter(r => r.exists).length,
      invalidCount: results.filter(r => !r.exists).length,
      total: results.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});