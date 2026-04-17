import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_EXECUTION_MS = 50000;
const SEND_TIMEOUT_MS = 15000;
const SEND_TIMEOUT_AUDIO_MS = 30000;
// Sentinel value: when we're actively processing, we set next_batch_at to this
// to prevent concurrent invocations from also processing.
const LOCK_DURATION_S = 90;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) throw new Error('campaign_id is required');

    const { data: campaign, error: campaignError } = await supabase
      .from('broadcast_campaigns').select('*').eq('id', campaign_id).single();

    if (campaignError || !campaign) throw new Error(`Campaign not found: ${campaignError?.message}`);

    if (['paused', 'completed', 'failed'].includes(campaign.status)) {
      return jsonResponse({ success: true, message: `Campaign is ${campaign.status}` });
    }

    // ── For draft campaigns: atomically transition to processing (no lock needed) ──
    if (campaign.status === 'draft') {
      const { data: transitionResult } = await supabase
        .from('broadcast_campaigns')
        .update({ 
          status: 'processing', 
          started_at: new Date().toISOString(),
          next_batch_at: null,
        })
        .eq('id', campaign_id)
        .eq('status', 'draft') // atomic: only one instance wins this
        .select('id');

      if (!transitionResult || transitionResult.length === 0) {
        console.log(`[broadcast-processor] Draft transition lost race for ${campaign_id}, exiting.`);
        return jsonResponse({ success: true, message: 'Another invocation is processing' });
      }

      console.log(`[broadcast-processor] Draft → processing for ${campaign_id}`);
      // Skip lock acquisition, we already own this campaign
    } else {
      // ── For processing campaigns: handle batch pause and lock ──
      if (campaign.next_batch_at) {
        const nextBatchTime = new Date(campaign.next_batch_at).getTime();
        const now = Date.now();

        if (nextBatchTime > now) {
          const diffMs = nextBatchTime - now;
          await sleep(Math.min(diffMs, 23000));
          selfInvoke(supabase, campaign_id);
          return jsonResponse({ success: true, message: 'Waiting for next batch' });
        }
        // Pause elapsed — proceed
      }

      // ── Acquire processing lock using atomic conditional update ──
      const lockUntil = new Date(Date.now() + LOCK_DURATION_S * 1000).toISOString();
      const nowIso = new Date().toISOString();
      
      // Use two separate queries to avoid .or() ISO timestamp parsing issues
      // First try: next_batch_at IS NULL
      let lockAcquired = false;
      const { data: r1 } = await supabase
        .from('broadcast_campaigns')
        .update({ next_batch_at: lockUntil })
        .eq('id', campaign_id)
        .is('next_batch_at', null)
        .select('id');
      
      lockAcquired = !!(r1 && r1.length > 0);

      if (!lockAcquired) {
        // Second try: next_batch_at is in the past
        const { data: r2 } = await supabase
          .from('broadcast_campaigns')
          .update({ next_batch_at: lockUntil })
          .eq('id', campaign_id)
          .lt('next_batch_at', nowIso)
          .select('id');
        
        lockAcquired = !!(r2 && r2.length > 0);
      }

      if (!lockAcquired) {
        console.log(`[broadcast-processor] Lock not acquired for ${campaign_id}, exiting.`);
        return jsonResponse({ success: true, message: 'Another invocation is processing' });
      }

      console.log(`[broadcast-processor] Lock acquired for ${campaign_id}`);
    }

    console.log(`[broadcast-processor] Lock acquired for ${campaign_id}`);

    // (draft→processing transition already handled above)

    // ── Config ──
    const isAudio = campaign.message_type === 'audio';
    const isMedia = ['image', 'video', 'document'].includes(campaign.message_type);
    const effectiveTimeout = isAudio ? SEND_TIMEOUT_AUDIO_MS : SEND_TIMEOUT_MS;
    const batchSize = campaign.batch_size || 10;
    const delayMinMs = campaign.delay_min_ms || 5000;
    const delayMaxMs = campaign.delay_max_ms || 15000;
    const delayBetweenBatchesMinMs = (campaign.delay_between_batches || 300) * 1000;
    const delayBetweenBatchesMaxMs = (campaign.delay_between_batches_max || campaign.delay_between_batches || 300) * 1000;

    // ── Media rotation setup ──
    const mediaUrls: string[] = campaign.media_urls || [];
    const mediaRotationMode: string = campaign.media_rotation_mode || 'random';
    let mediaSequentialIndex = 0;

    // ── Audio TTS setup ──
    let elevenLabsApiKey: string | null = null;
    let voiceProfile: any = null;
    if (isAudio) {
      // Fetch ElevenLabs API key from app_settings
      const { data: apiKeySetting } = await supabase
        .from('app_settings').select('value').eq('key', 'elevenlabs_api_key').single();
      elevenLabsApiKey = apiKeySetting?.value || null;
      if (!elevenLabsApiKey) throw new Error('ElevenLabs API key not configured in app_settings');

      // Fetch voice profile
      if (campaign.voice_profile_id) {
        const { data: vp } = await supabase
          .from('voice_profiles').select('*').eq('id', campaign.voice_profile_id).single();
        voiceProfile = vp;
      }
      if (!voiceProfile) {
        // Fallback to default voice profile
        const { data: defaultVp } = await supabase
          .from('voice_profiles').select('*').eq('is_default', true).limit(1).single();
        voiceProfile = defaultVp;
      }
      if (!voiceProfile) throw new Error('No voice profile found for audio campaign');
      console.log(`[broadcast-processor] Audio mode: voice="${voiceProfile.name}", model="${voiceProfile.elevenlabs_model}"`);
    }

    // Fetch exactly one full batch of pending recipients
    const { data: recipients, error: recipientsError } = await supabase
      .from('broadcast_recipients').select('*')
      .eq('campaign_id', campaign_id).eq('status', 'pending')
      .order('created_at', { ascending: true }).limit(batchSize);

    if (recipientsError) throw new Error(`Failed to fetch recipients: ${recipientsError.message}`);

    // ── No more recipients → campaign complete ──
    if (!recipients || recipients.length === 0) {
      await supabase.from('broadcast_campaigns')
        .update({ status: 'completed', completed_at: new Date().toISOString(), next_batch_at: null }).eq('id', campaign_id);
      return jsonResponse({ success: true, message: 'Campaign completed', processed: 0 });
    }

    // ── Process recipients sequentially with timeout safety ──
    const startTime = Date.now();
    let processedCount = 0, sentCount = 0, failedCount = 0;
    let hitTimeout = false;

    for (const recipient of recipients) {
      const elapsed = Date.now() - startTime;
      if (elapsed + effectiveTimeout + 2000 > MAX_EXECUTION_MS) {
        hitTimeout = true;
        break;
      }

      // Pause check every 5 messages
      if (processedCount > 0 && processedCount % 5 === 0) {
        const { data: curr } = await supabase.from('broadcast_campaigns').select('status').eq('id', campaign_id).single();
        if (curr?.status === 'paused') break;
      }

      try {
        const { text: spintaxResolved, indices } = resolveSpintaxWithIndices(campaign.message_template);
        const messageContent = applyTemplate(spintaxResolved, recipient.variables || {});
        const normalizedPhone = normalizeBrazilianPhone(recipient.phone_number) ?? recipient.phone_number.replace(/\D/g, '');

        let sendMessageType = campaign.message_type || 'text';
        let sendMediaUrl = campaign.media_url || undefined;

        // ── Media rotation: pick URL for this recipient ──
        if (isMedia && mediaUrls.length > 0) {
          if (mediaUrls.length === 1) {
            sendMediaUrl = mediaUrls[0];
          } else if (mediaRotationMode === 'sequential') {
            sendMediaUrl = mediaUrls[mediaSequentialIndex % mediaUrls.length];
            mediaSequentialIndex++;
          } else if (mediaRotationMode === 'fixed') {
            sendMediaUrl = mediaUrls[0];
          } else {
            // random (default)
            sendMediaUrl = mediaUrls[Math.floor(Math.random() * mediaUrls.length)];
          }
        }

        // ── Audio TTS: generate audio for this recipient ──
        if (isAudio && elevenLabsApiKey && voiceProfile) {
          const ttsResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceProfile.elevenlabs_voice_id}?output_format=mp3_44100_128`,
            {
              method: 'POST',
              headers: { 'xi-api-key': elevenLabsApiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: messageContent,
                model_id: voiceProfile.elevenlabs_model || 'eleven_turbo_v2_5',
                voice_settings: {
                  stability: voiceProfile.stability ?? 0.75,
                  similarity_boost: voiceProfile.similarity_boost ?? 0.8,
                  speed: Math.max(0.7, Math.min(1.2, voiceProfile.speed ?? 1.0)),
                },
              }),
            }
          );

          if (!ttsResponse.ok) {
            const errText = await ttsResponse.text();
            throw new Error(`ElevenLabs TTS error (${ttsResponse.status}): ${errText}`);
          }

          const audioBuffer = await ttsResponse.arrayBuffer();
          const audioBytes = new Uint8Array(audioBuffer);
          const filePath = `audio-broadcasts/${campaign_id}/${recipient.id}.mp3`;

          const { error: uploadError } = await supabase.storage
            .from('message-media')
            .upload(filePath, audioBytes, { contentType: 'audio/mpeg', upsert: true });

          if (uploadError) throw new Error(`Storage upload error: ${uploadError.message}`);

          const { data: publicUrlData } = supabase.storage
            .from('message-media')
            .getPublicUrl(filePath);

          sendMediaUrl = publicUrlData.publicUrl;
          sendMessageType = 'audio';
          console.log(`[broadcast-processor] TTS generated for recipient ${recipient.id}`);
        }

        const { data: sendResult, error: sendError } = await invokeWithTimeout(
          supabase, 'send-evolution-message',
          {
            instance_id: campaign.instance_id,
            phone_number: normalizedPhone,
            content: messageContent,
            message_type: sendMessageType,
            media_url: sendMediaUrl,
          },
          effectiveTimeout
        );

        if (sendError) throw new Error(sendError.message || 'Send function error');
        if (!sendResult?.success) throw new Error(sendResult?.error || 'Send failed');

        await supabase.from('broadcast_recipients')
          .update({ status: 'sent', sent_at: new Date().toISOString(), variation_indices: indices, sent_media_url: sendMediaUrl || null }).eq('id', recipient.id);
        sentCount++;

        // ── Auto-create deal on first contact ──
        try {
          // Check if this phone already has a deal
          const { data: existingDeals } = await supabase
            .from('deals')
            .select('id')
            .eq('contact_phone', normalizedPhone)
            .limit(1);

          if (!existingDeals || existingDeals.length === 0) {
            // Get first pipeline stage
            const { data: firstStage } = await supabase
              .from('pipeline_stages')
              .select('id')
              .eq('is_active', true)
              .order('position', { ascending: true })
              .limit(1)
              .single();

            if (firstStage) {
              // Try to get contact info
              const contactName = (recipient.variables as any)?.name || (recipient.variables as any)?.nome || '';
              const contactCompany = (recipient.variables as any)?.company || (recipient.variables as any)?.empresa || '';

              await supabase.from('deals').insert({
                title: contactName || normalizedPhone,
                company: contactCompany || '',
                contact_phone: normalizedPhone,
                contact_name: contactName || null,
                stage_id: firstStage.id,
                value: 0,
                priority: 'medium',
                tags: ['auto-broadcast'],
              });
              console.log(`[broadcast-processor] Deal auto-created for ${normalizedPhone}`);
            }
          }
        } catch (dealErr) {
          console.warn(`[broadcast-processor] Failed to auto-create deal: ${dealErr}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await supabase.from('broadcast_recipients')
          .update({ status: 'failed', error_message: errorMessage }).eq('id', recipient.id);
        failedCount++;
      }

      processedCount++;

      // Delay between messages (skip after last)
      if (processedCount < recipients.length) {
        const delay = getRandomDelay(delayMinMs, delayMaxMs);
        if (Date.now() - startTime + delay + effectiveTimeout > MAX_EXECUTION_MS) {
          hitTimeout = true;
          break;
        }
        await sleep(delay);
      }
    }

    // ── Persist counters ──
    await supabase.from('broadcast_campaigns').update({
      sent_count: (campaign.sent_count || 0) + sentCount,
      failed_count: (campaign.failed_count || 0) + failedCount,
    }).eq('id', campaign_id);

    console.log(`[broadcast-processor] Batch done: processed=${processedCount}, sent=${sentCount}, failed=${failedCount}, hitTimeout=${hitTimeout}`);

    // ── Check remaining ──
    const { count: remainingCount } = await supabase
      .from('broadcast_recipients').select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign_id).eq('status', 'pending');

    const hasMore = (remainingCount || 0) > 0;

    if (hasMore) {
      const { data: latestCampaign } = await supabase.from('broadcast_campaigns').select('status').eq('id', campaign_id).single();
      if (latestCampaign?.status === 'processing') {
        const completedFullBatch = !hitTimeout && processedCount >= recipients.length;
        if (completedFullBatch) {
          // Full batch done → schedule real pause
          const batchPauseMs = getRandomDelay(delayBetweenBatchesMinMs, delayBetweenBatchesMaxMs);
          const nextBatchAt = new Date(Date.now() + batchPauseMs).toISOString();
          await supabase.from('broadcast_campaigns').update({ next_batch_at: nextBatchAt }).eq('id', campaign_id);
          console.log(`[broadcast-processor] Full batch complete. Pausing until ${nextBatchAt} (${Math.round(batchPauseMs/1000)}s)`);
        } else {
          // Timeout mid-batch → release lock, continue immediately
          await supabase.from('broadcast_campaigns').update({ next_batch_at: null }).eq('id', campaign_id);
          console.log(`[broadcast-processor] Timeout mid-batch. Releasing lock for immediate continue.`);
        }
        // Wait a moment for DB to commit, then re-invoke
        await sleep(500);
        selfInvoke(supabase, campaign_id);
      } else {
        // Campaign was paused — release lock
        await supabase.from('broadcast_campaigns').update({ next_batch_at: null }).eq('id', campaign_id);
      }
    } else {
      await supabase.from('broadcast_campaigns')
        .update({ status: 'completed', completed_at: new Date().toISOString(), next_batch_at: null }).eq('id', campaign_id);
      console.log(`[broadcast-processor] Campaign completed!`);
    }

    return jsonResponse({
      success: true, processed: processedCount, sent: sentCount,
      failed: failedCount, remaining: remainingCount || 0, hasMore, hitTimeout,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[broadcast-processor] Error: ${message}`);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// ── Helpers ──

function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function selfInvoke(supabase: any, campaign_id: string) {
  supabase.functions.invoke('broadcast-processor', { body: { campaign_id } }).catch(console.error);
}

async function invokeWithTimeout(
  supabase: any, functionName: string, body: Record<string, unknown>, timeoutMs: number
): Promise<{ data: any; error: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await supabase.functions.invoke(functionName, { body, signal: controller.signal });
    return result;
  } catch (err: any) {
    if (err.name === 'AbortError') return { data: null, error: { message: `Timeout after ${timeoutMs}ms` } };
    return { data: null, error: { message: err.message || 'Unknown invoke error' } };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeBrazilianPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return null;
  if (digits.length === 10) {
    const firstDigit = parseInt(digits[2], 10);
    if (firstDigit >= 6) digits = digits.slice(0, 2) + '9' + digits.slice(2);
  }
  return '55' + digits;
}

function resolveSpintaxWithIndices(text: string): { text: string; indices: number[] } {
  const indices: number[] = [];
  const placeholders: string[] = [];
  let result = text.replace(/\{\{([^}]+)\}\}/g, (_match, name) => {
    const idx = placeholders.length;
    placeholders.push(`{{${name}}}`);
    return `\x00VAR${idx}\x00`;
  });
  result = result.replace(/\[OPCIONAL\]\s*([^\n]*)/gi, () => {
    const pick = Math.random() > 0.5 ? 0 : 1;
    indices.push(pick);
    return pick === 0 ? '' : '';
  });
  result = result.replace(/\{(\[OPCIONAL\])\s*([^}]*)\}/gi, (_match, _tag, content) => {
    const pick = Math.random() > 0.5 ? 0 : 1;
    indices.push(pick);
    return pick === 0 ? content.trim() : '';
  });
  const MAX_ITER = 50;
  let i = 0;
  while (result.includes('{') && i < MAX_ITER) {
    result = result.replace(/\{([^{}]+)\}/g, (_match, group) => {
      const options = group.split('|');
      const pick = Math.floor(Math.random() * options.length);
      indices.push(pick);
      return options[pick].trim();
    });
    i++;
  }
  result = result.replace(/\x00VAR(\d+)\x00/g, (_match, idx) => placeholders[parseInt(idx)]);
  result = result.replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim();
  return { text: result, indices };
}

function applyTemplate(template: string, variables: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    return value !== undefined && value !== null ? String(value) : match;
  });
}

function getRandomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
