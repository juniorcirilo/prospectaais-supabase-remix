import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Each invocation handles ONE step, then chains to the next.
// Steps: match → website_discovery → org_enrich → collaborators → match_collaborators → firecrawl → persist_companies → create_company_contacts → ai_summaries → update_contacts → done
const STEP_ORDER = ["match", "website_discovery", "org_enrich", "collaborators", "match_collaborators", "firecrawl", "persist_companies", "create_company_contacts", "ai_summaries", "update_contacts"];
const DEADLINE_MS = 110_000; // 110s safe margin (runtime kills at ~150s)
const FETCH_TIMEOUT_MS = 25_000; // 25s per external call

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read Apollo key from app_settings (database) instead of env
  const { data: apolloSetting } = await supabase
    .from("app_settings").select("value").eq("key", "apollo_api_key").single();
  const apolloKey = apolloSetting?.value || null;

  const startedAt = Date.now();
  const timeRemaining = () => DEADLINE_MS - (Date.now() - startedAt);
  const isTimedOut = () => timeRemaining() < 5_000; // 5s guard
  const hasTimeForExternalCall = () => timeRemaining() > FETCH_TIMEOUT_MS + 5_000;

  try {
    const body = await req.json();
    const { searchId, fixStatus, step: requestedStep, cursor: requestedCursor, runId: requestedRunId } = body;

    // Quick fix endpoint
    if (fixStatus && searchId) {
      await supabase.from("lead_searches").update({ 
        status: "completed", enrich_step: null, enrich_cursor: 0, enrich_run_id: null 
      }).eq("id", searchId);
      return jsonResp({ success: true, fixed: true });
    }

    if (!searchId) return jsonResp({ success: false, error: "searchId is required" }, 400);

    const { data: search, error: searchErr } = await supabase
      .from("lead_searches").select("*").eq("id", searchId).single();
    if (searchErr || !search) return jsonResp({ success: false, error: "Search not found" }, 404);

    // Determine step and run_id
    const runId = requestedRunId || crypto.randomUUID();
    const currentStep = requestedStep || "match";
    const cursor = requestedCursor || 0;

    // Check for stale run — if another run is active, abort
    if (search.enrich_run_id && search.enrich_run_id !== runId && requestedRunId) {
      console.log(`[lead-enrich] Aborting stale run ${runId}, active: ${search.enrich_run_id}`);
      return jsonResp({ success: false, error: "Another run is active" });
    }

    const contacts: any[] = Array.isArray(search.result_data) ? [...search.result_data] : [];
    if (contacts.length === 0) return jsonResp({ success: true, enriched: 0 });

    // Update status + heartbeat
    await supabase.from("lead_searches").update({
      status: "enriching",
      enrich_step: currentStep,
      enrich_cursor: cursor,
      enrich_run_id: runId,
      enrich_heartbeat: new Date().toISOString(),
    }).eq("id", searchId);

    console.log(`[lead-enrich] Step: ${currentStep}, cursor: ${cursor}, contacts: ${contacts.length}, runId: ${runId.slice(0, 8)}`);

    let enrichedCount = search.contacts_enriched || 0;
    let nextStep: string | null = null;
    let nextCursor = 0;

    // Helper to chain immediately (saves checkpoint + fires next invocation)
    const chainNow = async (step: string, cur: number, reason: string) => {
      const cleanContacts = cleanInternalFlags(contacts);
      await supabase.from("lead_searches").update({
        result_data: cleanContacts,
        contacts_found: cleanContacts.length,
        contacts_enriched: enrichedCount,
        enrich_step: step,
        enrich_cursor: cur,
        enrich_heartbeat: new Date().toISOString(),
      }).eq("id", searchId);

      // Cooldown before re-chain when rate-limited, to avoid hot-loop invocations
      if (reason.includes("429") || reason.includes("rate-limit")) {
        const targetCooldown = reason.includes("apollo-429-persistent") ? 45_000 : 15_000;
        const cooldownMs = Math.min(targetCooldown, Math.max(0, timeRemaining() - 8_000));
        if (cooldownMs > 0) {
          console.log(`[lead-enrich] Rate-limit cooldown ${Math.round(cooldownMs / 1000)}s before chain`);
          await new Promise((resolve) => setTimeout(resolve, cooldownMs));
        }
      }

      console.log(`[lead-enrich] Chaining → ${step} cursor=${cur} (${reason}, elapsed ${Math.round((Date.now() - startedAt) / 1000)}s)`);
      fetch(`${supabaseUrl}/functions/v1/lead-enrich-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify({ searchId, step, cursor: cur, runId }),
      }).catch((e) => console.error("[lead-enrich] Chain error:", e));
      return jsonResp({ success: true, step: currentStep, nextStep: step, nextCursor: cur, enriched: enrichedCount });
    };

    // ═══════════════════════════════════════════════════════════
    // STEP: match — Apollo People Match
    // ═══════════════════════════════════════════════════════════
    if (currentStep === "match") {
      let matchRateLimitHits = 0;
      if (apolloKey) {
        const matchable = contacts.filter((c: any) =>
          c._apollo_person_id ||
          c.email ||
          c.linkedin_url ||
          (c.name && (c.company || c.organization_name || c.website))
        );
        const BATCH = 6;
        const start = cursor;
        const end = Math.min(start + BATCH, matchable.length);
        console.log(`[lead-enrich] Step match: ${start}-${end} of ${matchable.length}`);
        let matchStats = { attempted: 0, matched_ok: 0, deadline_chains: 0, errors: 0, rate_limit_429: 0 };

        for (let idx = start; idx < end; idx++) {
          if (isTimedOut() || !hasTimeForExternalCall()) {
            console.log(`[lead-enrich] Match batch stats:`, JSON.stringify(matchStats));
            return await chainNow("match", idx, "deadline");
          }
          const c = matchable[idx];
          if (!c.company && c.organization_name) c.company = c.organization_name;
          matchStats.attempted++;
          try {
            const mr = await apolloPeopleMatch(apolloKey, c, timeRemaining);
            if (!mr) continue;
            if (!c.name && mr.name) c.name = mr.name;
            if (!c.phone && mr.phone) c.phone = mr.phone;
            if ((!c.email || isGenericEmail(c.email)) && mr.email && !isGenericEmail(mr.email)) c.email = mr.email;
            if (!c.linkedin_url && mr.linkedin_url && !isCompanyLinkedIn(mr.linkedin_url)) c.linkedin_url = mr.linkedin_url;
            if (mr.linkedin_url && isCompanyLinkedIn(mr.linkedin_url) && !c.company_linkedin) c.company_linkedin = mr.linkedin_url;
            if (!c.title && mr.title) c.title = mr.title;
            if (mr.seniority) c.seniority = mr.seniority;
            if (mr.primary_domain) { c._primary_domain = mr.primary_domain; c._apollo_org_id = mr.organization_id; }
            if (mr.website) c.website = cleanWebsiteUrl(mr.website);
            if (mr.revenue) c.revenue = mr.revenue;
            if (mr.employees_count) c.employees_count = mr.employees_count;
            c._apollo_matched = true;
            if (mr.email || mr.phone) enrichedCount++;
            matchStats.matched_ok++;
          } catch (e: any) {
            // DEADLINE_CHAIN is flow-control
            if (e?.message?.startsWith?.("DEADLINE_CHAIN")) {
              matchStats.deadline_chains++;
              console.log(`[lead-enrich] Match batch stats:`, JSON.stringify(matchStats));
              return await chainNow("match", idx, "deadline-chain-429");
            }

            // Apollo persistently rate-limited: fallback to Firecrawl for this contact before chaining
            if (e?.message?.startsWith?.("APOLLO_429_PERSISTENT")) {
              matchStats.rate_limit_429++;
              matchRateLimitHits++;

              let recovered = false;
              if (firecrawlKey) {
                try {
                  const fallback = await discoverCompanyDataViaFirecrawl(firecrawlKey, c, search.config);
                  if (fallback) {
                    if (!c.website && fallback.website) c.website = cleanWebsiteUrl(fallback.website);
                    if (fallback.email && !c.company_email) c.company_email = fallback.email;
                    // NEVER copy company phone to personal phone field
                    if (fallback.phone && !c.company_phone) c.company_phone = fallback.phone;
                    if (!c.city && fallback.city) c.city = fallback.city;
                    if (!c.company_description && fallback.company_description) c.company_description = fallback.company_description;
                    if (!c.instagram && fallback.instagram) c.instagram = fallback.instagram;
                    if (!c.linkedin_url && fallback.linkedin_url && !isCompanyLinkedIn(fallback.linkedin_url)) c.linkedin_url = fallback.linkedin_url;
                    if (fallback.linkedin_url && isCompanyLinkedIn(fallback.linkedin_url) && !c.company_linkedin) c.company_linkedin = fallback.linkedin_url;

                    if ((fallback.email || fallback.phone || fallback.website)) {
                      recovered = true;
                      matchStats.matched_ok++;
                      if (fallback.website) enrichedCount++;
                    }
                  }
                } catch (fallbackErr) {
                  console.warn(`[lead-enrich] Firecrawl fallback failed:`, fallbackErr);
                }
              }

              if (!recovered) {
                // Don't hot-loop same contact forever under provider throttle; defer to website_discovery path
                console.warn(`[lead-enrich] Apollo still rate-limited for contact ${idx}; deferring to website_discovery fallback`);
              }

              // Fallback recovered OR deferred to website_discovery path
              continue;
            }

            matchStats.errors++;
            console.error(`[lead-enrich] Match error:`, e);
          }

          // Incremental checkpoint every 5 contacts
          if ((idx - start + 1) % 5 === 0) {
            const cleanPartial = cleanInternalFlags(contacts);
            await supabase.from("lead_searches").update({
              result_data: cleanPartial,
              contacts_enriched: enrichedCount,
              enrich_heartbeat: new Date().toISOString(),
            }).eq("id", searchId);
          }
        }
        console.log(`[lead-enrich] Match batch stats:`, JSON.stringify(matchStats));
        // When Apollo is throttled, pivot to website discovery instead of looping match endlessly
        if (!nextStep && matchRateLimitHits === 0 && end < matchable.length) { nextStep = "match"; nextCursor = end; }
      }
      if (!nextStep && firecrawlKey && matchRateLimitHits > 0) { nextStep = "website_discovery"; nextCursor = 0; }
      if (!nextStep) { nextStep = "org_enrich"; nextCursor = 0; }
    }

    // ═══════════════════════════════════════════════════════════
    // STEP: website_discovery — Firecrawl search by company (fallback path)
    // ═══════════════════════════════════════════════════════════
    else if (currentStep === "website_discovery") {
      if (firecrawlKey) {
        const isSocialMedia = (url: string) => {
          if (!url) return false;
          const lower = url.toLowerCase();
          return /instagram\.com|facebook\.com|linkedin\.com|twitter\.com|x\.com/i.test(lower);
        };
        const pending = contacts.filter((c: any) =>
          (!c.website || isSocialMedia(c.website)) && (c.company || c.organization_name)
        );
        const BATCH = 3;
        const start = cursor;
        const end = Math.min(start + BATCH, pending.length);
        console.log(`[lead-enrich] Step website_discovery: ${start}-${end} of ${pending.length}`);

        for (let idx = start; idx < end; idx++) {
          if (isTimedOut() || !hasTimeForExternalCall()) {
            return await chainNow("website_discovery", idx, "deadline");
          }

          const c = pending[idx];
          try {
            const fallback = await discoverCompanyDataViaFirecrawl(firecrawlKey, c, search.config);
            if (!fallback) continue;

            if (!c.website && fallback.website) c.website = cleanWebsiteUrl(fallback.website);
            if (fallback.email && !c.company_email) c.company_email = fallback.email;
            // NEVER copy company phone to personal phone field
            if (fallback.phone && !c.company_phone) c.company_phone = fallback.phone;
            if (!c.city && fallback.city) c.city = fallback.city;
            if (!c.company_description && fallback.company_description) c.company_description = fallback.company_description;
            if (!c.instagram && fallback.instagram) c.instagram = fallback.instagram;
            if (!c.linkedin_url && fallback.linkedin_url && !isCompanyLinkedIn(fallback.linkedin_url)) c.linkedin_url = fallback.linkedin_url;
            if (fallback.linkedin_url && isCompanyLinkedIn(fallback.linkedin_url) && !c.company_linkedin) c.company_linkedin = fallback.linkedin_url;
            if (fallback.website) enrichedCount++;
          } catch (e) {
            console.warn(`[lead-enrich] website_discovery error:`, e);
          }
        }

        if (!nextStep && end < pending.length) { nextStep = "website_discovery"; nextCursor = end; }
      }

      // Continue to scraping; this path is meant to recover data without depending on Apollo
      if (!nextStep) { nextStep = "firecrawl"; nextCursor = 0; }
    }

    // ═══════════════════════════════════════════════════════════
    // STEP: org_enrich — Apollo Org Enrich by domain
    // ═══════════════════════════════════════════════════════════
    else if (currentStep === "org_enrich") {
      if (apolloKey) {
        const domainsArr: string[] = [];
        const seen = new Set<string>();
        for (const c of contacts) {
          const d = c._primary_domain || extractDomainFromEmail(c.email) || extractDomainFromWebsite(c.website);
          if (d && !seen.has(d)) { seen.add(d); domainsArr.push(d); }
        }
        const BATCH = 10;
        const start = cursor;
        const end = Math.min(start + BATCH, domainsArr.length);
        console.log(`[lead-enrich] Step org_enrich: ${start}-${end} of ${domainsArr.length} domains`);

        const orgCache = new Map<string, any>();
        for (let idx = start; idx < end; idx++) {
          if (isTimedOut() || !hasTimeForExternalCall()) {
            applyOrgCache(contacts, orgCache);
            return await chainNow("org_enrich", idx, "deadline");
          }
          const domain = domainsArr[idx];
          try {
            const orgData = await apolloOrgEnrich(apolloKey, domain, timeRemaining);
            if (orgData) orgCache.set(domain, orgData);
          } catch (e: any) {
            if (e?.message?.startsWith?.("DEADLINE_CHAIN") || e?.message?.startsWith?.("APOLLO_429_PERSISTENT")) {
              applyOrgCache(contacts, orgCache);
              return await chainNow("org_enrich", idx, "org-enrich-rate-limit");
            }
            console.error(`[lead-enrich] Org enrich error:`, e);
          }
        }
        applyOrgCache(contacts, orgCache);
        if (!nextStep && end < domainsArr.length) { nextStep = "org_enrich"; nextCursor = end; }
      }
      if (!nextStep) { nextStep = "collaborators"; nextCursor = 0; }
    }

    // ═══════════════════════════════════════════════════════════
    // STEP: collaborators — Apollo expansion
    // ═══════════════════════════════════════════════════════════
    else if (currentStep === "collaborators") {
      if (apolloKey) {
        const orgIds: string[] = [];
        const orgIdSet = new Set<string>();
        for (const c of contacts) {
          if (c._apollo_org_id && !orgIdSet.has(c._apollo_org_id)) { orgIdSet.add(c._apollo_org_id); orgIds.push(c._apollo_org_id); }
        }
        const BATCH = 5;
        const start = cursor;
        const end = Math.min(start + BATCH, orgIds.length);
        console.log(`[lead-enrich] Step collaborators: ${start}-${end} of ${orgIds.length} orgs`);

        const existingNames = new Set(contacts.map((c: any) => (c.name || "").toLowerCase().trim()));
        const existingEmails = new Set(contacts.map((c: any) => (c.email || "").toLowerCase().trim()).filter(Boolean));
        let expandedCount = 0;

        for (let idx = start; idx < end; idx++) {
          if (isTimedOut() || !hasTimeForExternalCall()) {
            if (expandedCount > 0) {
              await supabase.from("lead_searches").update({ contacts_found: contacts.length }).eq("id", searchId);
            }
            return await chainNow("collaborators", idx, "deadline");
          }
          const orgId = orgIds[idx];
          try {
            const collaborators = await apolloCollaboratorSearch(apolloKey, orgId, timeRemaining);
            if (collaborators.length === 0) continue;

            const MAX_PER_COMPANY = 3;
            const existingForOrg = contacts.filter((c: any) => c._apollo_org_id === orgId).length;
            const slots = Math.max(0, MAX_PER_COMPANY - existingForOrg);
            let added = 0;

            for (const col of collaborators) {
              if (added >= slots) break;
              const nameLower = (col.name || "").toLowerCase().trim();
              const emailLower = (col.email || "").toLowerCase().trim();
              if (nameLower && existingNames.has(nameLower)) continue;
              if (emailLower && existingEmails.has(emailLower)) continue;
              if (!col.name || col.name.trim().length < 3) continue;

              const ref = contacts.find((c: any) => c._apollo_org_id === orgId);
              const collaboratorPersonalLinkedIn = col.linkedin_url && !isCompanyLinkedIn(col.linkedin_url) ? col.linkedin_url : "";
              const collaboratorCompanyLinkedIn = col.linkedin_url && isCompanyLinkedIn(col.linkedin_url)
                ? col.linkedin_url
                : (ref?.company_linkedin || "");

              contacts.push({
                name: col.name, email: col.email || "", phone: col.phone || "",
                title: col.title || "", seniority: col.seniority || "",
                linkedin_url: collaboratorPersonalLinkedIn,
                company: ref?.company || "", city: ref?.city || "",
                website: ref?.website || "", revenue: ref?.revenue || "",
                employees_count: ref?.employees_count || "",
                industry: ref?.industry || "", company_description: ref?.company_description || "",
                company_linkedin: collaboratorCompanyLinkedIn,
                _apollo_person_id: col._apollo_person_id || "",
                _apollo_org_id: orgId,
                _apollo_matched: false,
                _source: "expansion",
              });
              existingNames.add(nameLower);
              if (emailLower) existingEmails.add(emailLower);
              expandedCount++;
              added++;
            }
          } catch (e: any) {
            if (e?.message?.startsWith?.("DEADLINE_CHAIN") || e?.message?.startsWith?.("APOLLO_429_PERSISTENT")) {
              if (expandedCount > 0) {
                await supabase.from("lead_searches").update({ contacts_found: contacts.length }).eq("id", searchId);
              }
              return await chainNow("collaborators", idx, "collaborators-rate-limit");
            }
            console.error(`[lead-enrich] Collaborator error:`, e);
          }
        }
        if (expandedCount > 0) {
          console.log(`[lead-enrich] Expansion added ${expandedCount} contacts (total: ${contacts.length})`);
          await supabase.from("lead_searches").update({ contacts_found: contacts.length }).eq("id", searchId);
        }
        if (!nextStep && end < orgIds.length) { nextStep = "collaborators"; nextCursor = end; }
      }
      if (!nextStep) { nextStep = "match_collaborators"; nextCursor = 0; }
    }

    // ═══════════════════════════════════════════════════════════
    // STEP: match_collaborators — Run /people/match on collaborators added in previous step
    // These contacts have _apollo_person_id but no phone/email yet
    // ═══════════════════════════════════════════════════════════
    else if (currentStep === "match_collaborators") {
      if (apolloKey) {
        const unmatched = contacts.filter((c: any) =>
          c._source === "expansion" && c._apollo_person_id && !c._apollo_matched
        );
        const BATCH = 6;
        const start = cursor;
        const end = Math.min(start + BATCH, unmatched.length);
        console.log(`[lead-enrich] Step match_collaborators: ${start}-${end} of ${unmatched.length}`);

        for (let idx = start; idx < end; idx++) {
          if (isTimedOut() || !hasTimeForExternalCall()) {
            return await chainNow("match_collaborators", idx, "deadline");
          }
          const c = unmatched[idx];
          try {
            const mr = await apolloPeopleMatch(apolloKey, c, timeRemaining);
            if (!mr) continue;
            if (!c.name && mr.name) c.name = mr.name;
            if (!c.phone && mr.phone) c.phone = mr.phone;
            if ((!c.email || isGenericEmail(c.email)) && mr.email && !isGenericEmail(mr.email)) c.email = mr.email;
            if (!c.linkedin_url && mr.linkedin_url && !isCompanyLinkedIn(mr.linkedin_url)) c.linkedin_url = mr.linkedin_url;
            if (mr.linkedin_url && isCompanyLinkedIn(mr.linkedin_url) && !c.company_linkedin) c.company_linkedin = mr.linkedin_url;
            if (!c.title && mr.title) c.title = mr.title;
            if (mr.seniority) c.seniority = mr.seniority;
            if (mr.primary_domain) { c._primary_domain = mr.primary_domain; c._apollo_org_id = mr.organization_id; }
            if (mr.website) c.website = cleanWebsiteUrl(mr.website);
            c._apollo_matched = true;
            if (mr.email || mr.phone) enrichedCount++;
          } catch (e: any) {
            if (e?.message?.startsWith?.("DEADLINE_CHAIN") || e?.message?.startsWith?.("APOLLO_429_PERSISTENT")) {
              return await chainNow("match_collaborators", idx, "collaborator-match-rate-limit");
            }
            console.error(`[lead-enrich] Collaborator match error:`, e);
          }

          // Checkpoint every 5
          if ((idx - start + 1) % 5 === 0) {
            const cleanPartial = cleanInternalFlags(contacts);
            await supabase.from("lead_searches").update({
              result_data: cleanPartial,
              contacts_enriched: enrichedCount,
              enrich_heartbeat: new Date().toISOString(),
            }).eq("id", searchId);
          }
        }
        if (!nextStep && end < unmatched.length) { nextStep = "match_collaborators"; nextCursor = end; }
      }
      if (!nextStep) { nextStep = "firecrawl"; nextCursor = 0; }
    }

    // ═══════════════════════════════════════════════════════════
    // STEP: firecrawl — Site discovery + scraping
    // With incremental checkpoint per site
    // ═══════════════════════════════════════════════════════════
    else if (currentStep === "firecrawl") {
      if (firecrawlKey) {
        const isSocialMedia = (url: string) => {
          const lower = url.toLowerCase();
          return /instagram\.com|facebook\.com|linkedin\.com|twitter\.com|x\.com/i.test(lower);
        };
        const withWebsite = contacts.filter((c: any) => c.website && !c._site_scraped && !isSocialMedia(c.website));
        const uniqueSites = [...new Set(withWebsite.map((c: any) => c.website as string))];
        const BATCH = 3;
        const start = cursor;
        const end = Math.min(start + BATCH, uniqueSites.length);
        console.log(`[lead-enrich] Step firecrawl: ${start}-${end} of ${uniqueSites.length} sites`);

        for (let idx = start; idx < end; idx++) {
          // Check deadline BEFORE each site scrape (incremental checkpoint)
          if (isTimedOut() || !hasTimeForExternalCall()) {
            return await chainNow("firecrawl", idx, "deadline-before-site");
          }
          const website = uniqueSites[idx];
          try {
            const extraData = await fetchWithTimeout(
              () => scrapeCompanyWebsite(firecrawlKey, website),
              FETCH_TIMEOUT_MS
            );
            if (extraData) {
              for (const c of contacts) {
                if (c.website === website) {
                  c.company_description = extraData.description || c.company_description || "";
                  c.company_services = extraData.services || c.company_services || "";
                  c.company_address = extraData.address || c.company_address || "";
                  if (extraData.phone) c.company_phone = extraData.phone;
                  if (extraData.email) c.company_email = extraData.email;
                  if (!c.instagram && extraData.instagram) c.instagram = extraData.instagram;
                  if (!c.facebook && extraData.facebook) c.facebook = extraData.facebook;
                  if (extraData.whatsapp) c.whatsapp_site = extraData.whatsapp;
                  if (extraData.founding_year) c.founding_year = c.founding_year || extraData.founding_year;
                  if (extraData.employees_approx) c.employees_count = c.employees_count || extraData.employees_approx;
                  c._site_scraped = true;
                }
              }
            }
          } catch (e) {
            console.warn(`[lead-enrich] Scrape error for ${website}, skipping:`, e instanceof Error ? e.message : e);
            // Mark as scraped to avoid retrying forever
            for (const c of contacts) {
              if (c.website === website) c._site_scraped = true;
            }
          }
        }
        if (!nextStep && end < uniqueSites.length) { nextStep = "firecrawl"; nextCursor = end; }
      }
      if (!nextStep) { nextStep = "persist_companies"; nextCursor = 0; }
    }

    // ═══════════════════════════════════════════════════════════
    // STEP: persist_companies
    // ═══════════════════════════════════════════════════════════
    else if (currentStep === "persist_companies") {
      const companyMap = new Map<string, any[]>();
      for (const c of contacts) {
        const key = (c.company || c.organization_name || "").toLowerCase().trim();
        if (!key || key.length < 2) continue;
        if (!companyMap.has(key)) companyMap.set(key, []);
        companyMap.get(key)!.push(c);
      }
      const companyKeys = [...companyMap.keys()];
      const BATCH = 10;
      const start = cursor;
      const end = Math.min(start + BATCH, companyKeys.length);
      console.log(`[lead-enrich] Step persist_companies: ${start}-${end} of ${companyKeys.length}`);

      for (let idx = start; idx < end; idx++) {
        if (isTimedOut()) {
          return await chainNow("persist_companies", idx, "deadline");
        }
        const key = companyKeys[idx];
        const companyContacts = companyMap.get(key)!;
        const ref = companyContacts[0];
        const domain = extractDomainFromWebsite(ref.website) || extractDomainFromEmail(ref.email) || null;

        let existingCompany: any = null;
        if (domain) {
          const { data } = await supabase.from("lead_companies").select("id").eq("search_id", searchId).eq("domain", domain).limit(1).maybeSingle();
          existingCompany = data;
        }
        if (!existingCompany) {
          const { data } = await supabase.from("lead_companies").select("id").eq("search_id", searchId).ilike("name", ref.company || ref.organization_name || "").limit(1).maybeSingle();
          existingCompany = data;
        }

        const companyData = {
          search_id: searchId, name: ref.company || ref.organization_name || "",
          domain: domain || "", website: ref.website || "", city: ref.city || "",
          industry: ref.industry || "", description: ref.company_description || "",
          services: ref.company_services || "", linkedin_url: ref.company_linkedin || "",
          instagram: ref.instagram || "", facebook: ref.facebook || "",
          phone: ref.company_phone || "", email: ref.company_email || "",
          whatsapp: ref.whatsapp_site || "", address: ref.company_address || "",
          revenue: ref.revenue || "", employees_count: ref.employees_count || "",
          founding_year: ref.founding_year || "", apollo_org_id: ref._apollo_org_id || "",
          updated_at: new Date().toISOString(),
        };

        let companyId: string;
        if (existingCompany) {
          await supabase.from("lead_companies").update(companyData).eq("id", existingCompany.id);
          companyId = existingCompany.id;
        } else {
          const { data: inserted } = await supabase.from("lead_companies").insert(companyData).select("id").single();
          companyId = inserted?.id || "";
        }
        if (companyId) {
          for (const c of companyContacts) c._lead_company_id = companyId;
        }
      }
      if (!nextStep && end < companyKeys.length) { nextStep = "persist_companies"; nextCursor = end; }
      if (!nextStep) { nextStep = "create_company_contacts"; nextCursor = 0; }
    }

    // ═══════════════════════════════════════════════════════════
    // STEP: create_company_contacts — Create "phantom" contacts for companies
    // ═══════════════════════════════════════════════════════════
    else if (currentStep === "create_company_contacts") {
      const companyMap = new Map<string, any[]>();
      for (const c of contacts) {
        const key = (c.company || c.organization_name || "").toLowerCase().trim();
        if (!key || key.length < 2) continue;
        if (!companyMap.has(key)) companyMap.set(key, []);
        companyMap.get(key)!.push(c);
      }

      const companyKeys = [...companyMap.keys()];
      console.log(`[lead-enrich] Step create_company_contacts: processing ${companyKeys.length} companies`);

      const existingCompanyContactNames = new Set(
        contacts.filter((c: any) => c._is_company_contact).map((c: any) => (c.company || "").toLowerCase().trim())
      );

      for (const key of companyKeys) {
        if (isTimedOut()) {
          return await chainNow("create_company_contacts", 0, "deadline");
        }

        // Skip if company contact already exists
        if (existingCompanyContactNames.has(key)) continue;

        const companyContacts = companyMap.get(key)!;
        const ref = companyContacts[0];

        // Only create company contact if we have company_phone or company_email
        const hasCompanyPhone = ref.company_phone && ref.company_phone.trim().length > 0;
        const hasCompanyEmail = ref.company_email && ref.company_email.trim().length > 0;

        if (!hasCompanyPhone && !hasCompanyEmail) continue;

        // Create phantom contact representing the company
        const companyContact = {
          name: ref.company || ref.organization_name || "",
          company: ref.company || ref.organization_name || "",
          phone: hasCompanyPhone ? ref.company_phone : "",
          email: hasCompanyEmail ? ref.company_email : "",
          title: "Empresa", // Marker to identify it's a company contact
          city: ref.city || "",
          website: ref.website || "",
          revenue: ref.revenue || "",
          employees_count: ref.employees_count || "",
          industry: ref.industry || "",
          company_description: ref.company_description || "",
          company_services: ref.company_services || "",
          company_linkedin: ref.company_linkedin || "",
          instagram: ref.instagram || "",
          facebook: ref.facebook || "",
          linkedin_url: "",
          whatsapp_site: ref.whatsapp_site || "",
          company_address: ref.company_address || "",
          founding_year: ref.founding_year || "",
          company_phone: ref.company_phone || "",
          company_email: ref.company_email || "",
          _lead_company_id: ref._lead_company_id || "",
          _apollo_org_id: ref._apollo_org_id || "",
          _is_company_contact: true, // Flag to identify this is a company contact
          _source: "company_contact",
        };

        contacts.push(companyContact);
        console.log(`[lead-enrich] Created company contact for: ${companyContact.name}`);
      }

      if (!nextStep) { nextStep = "ai_summaries"; nextCursor = 0; }
    }

    // ═══════════════════════════════════════════════════════════
    // STEP: ai_summaries
    // ═══════════════════════════════════════════════════════════
    else if (currentStep === "ai_summaries") {
      if (lovableKey) {
        const AI_BATCH = 10;
        const start = cursor;
        const end = Math.min(start + AI_BATCH, contacts.length);
        console.log(`[lead-enrich] Step ai_summaries: ${start}-${end} of ${contacts.length}`);

        if (!hasTimeForExternalCall()) {
          return await chainNow("ai_summaries", start, "deadline");
        }

        const batch = contacts.slice(start, end);
        try {
          const summaries = await fetchWithTimeout(
            () => generateAISummaries(lovableKey, batch, search.config),
            FETCH_TIMEOUT_MS * 2 // AI can take longer
          );
          for (let j = 0; j < batch.length; j++) {
            const s = summaries[j];
            if (s) {
              batch[j].ai_summary = s.summary || "";
              batch[j].ai_tags = s.tags || [];
              batch[j].ai_score = s.relevance_score || 0;
              batch[j].ai_insights = s.insights || "";
              enrichedCount++;
            }
          }
        } catch (e) { console.error(`[lead-enrich] AI batch error:`, e); }

        if (!nextStep && end < contacts.length) { nextStep = "ai_summaries"; nextCursor = end; }
      }
      if (!nextStep) { nextStep = "update_contacts"; nextCursor = 0; }
    }

    // ═══════════════════════════════════════════════════════════
    // STEP: update_contacts — write back to contacts table
    // ═══════════════════════════════════════════════════════════
    else if (currentStep === "update_contacts") {
      const BATCH = 15;
      const start = cursor;
      const end = Math.min(start + BATCH, contacts.length);
      console.log(`[lead-enrich] Step update_contacts: ${start}-${end} of ${contacts.length}`);

      for (let idx = start; idx < end; idx++) {
        if (isTimedOut()) {
          return await chainNow("update_contacts", idx, "deadline");
        }

        const c = contacts[idx];
        const rawPhone = c.phone ? String(c.phone).replace(/\D/g, "") : "";
        const phoneCandidates = [...new Set([
          rawPhone,
          rawPhone.startsWith("55") ? rawPhone.slice(2) : rawPhone,
          rawPhone && !rawPhone.startsWith("55") ? `55${rawPhone}` : rawPhone,
        ].filter((p) => !!p && p.length >= 10))];

        let existing: any = null;

        if (c._contact_id) {
          const { data } = await supabase
            .from("contacts")
            .select("id, custom_fields, phone")
            .eq("id", c._contact_id)
            .maybeSingle();
          existing = data;
        }

        if (!existing && phoneCandidates.length > 0) {
          const orFilter = phoneCandidates.map((p) => `phone.eq.${p}`).join(",");
          const { data } = await supabase
            .from("contacts")
            .select("id, custom_fields, phone")
            .or(orFilter)
            .limit(1)
            .maybeSingle();
          existing = data;
        }

        if (!existing && c.name && c.company) {
          const { data } = await supabase
            .from("contacts")
            .select("id, custom_fields, phone")
            .ilike("name", c.name)
            .ilike("company", c.company)
            .limit(1)
            .maybeSingle();
          existing = data;
        }

        if (!existing) {
          const seedPhone = phoneCandidates[0] || "";
          const { data: upserted, error: upsertErr } = await supabase.rpc("upsert_lead_contact", {
            p_name: c.name || "",
            p_phone: seedPhone,
            p_company: c.company || c.organization_name || "",
            p_city: c.city || "",
            p_tags: ["lead-search", c._source === "expansion" ? "expansion" : "enriched"],
            p_list_id: search.target_list_id || null,
            p_custom_fields: {
              email: c.email || "",
              linkedin: c.linkedin_url || "",
              title: c.title || "",
              source_search_id: searchId,
            },
            p_score: 0,
          });

          if (upsertErr || !upserted?.id) {
            console.warn("[lead-enrich] update_contacts upsert failed:", upsertErr);
            continue;
          }

          existing = { id: upserted.id, custom_fields: {}, phone: seedPhone };
          c._contact_id = upserted.id;
        }

        const updatedFields = {
          ...((existing.custom_fields as any) || {}),
          ai_summary: c.ai_summary || "", ai_tags: c.ai_tags || [],
          ai_score: c.ai_score || 0, ai_insights: c.ai_insights || "",
          company_description: c.company_description || "", company_services: c.company_services || "",
          website: c.website || "", instagram: c.instagram || "", facebook: c.facebook || "",
          linkedin_url: c.linkedin_url || "", founding_year: c.founding_year || "",
          whatsapp_site: c.whatsapp_site || "", seniority: c.seniority || "",
          industry: c.industry || "", company_linkedin: c.company_linkedin || "",
          company_email: c.company_email || "", company_phone: c.company_phone || "",
        };

        const updateData: any = {
          custom_fields: updatedFields,
          updated_at: new Date().toISOString(),
        };

        if ((!existing.phone || String(existing.phone).trim().length === 0) && phoneCandidates[0]) {
          updateData.phone = phoneCandidates[0];
        }
        if (c._lead_company_id) updateData.lead_company_id = c._lead_company_id;

        await supabase.from("contacts").update(updateData).eq("id", existing.id);
      }

      if (!nextStep && end < contacts.length) { nextStep = "update_contacts"; nextCursor = end; }
      if (!nextStep) nextStep = "done";
    }

    // ═══════════════════════════════════════════════════════════
    // SAVE CHECKPOINT + CHAIN OR COMPLETE
    // ═══════════════════════════════════════════════════════════

    const cleanContacts = cleanInternalFlags(contacts);

    if (nextStep === "done" || !nextStep) {
      // Keep Apollo ids in result_data so retries can use exact matching by id.
      const finalContacts = cleanContacts;

      await supabase.from("lead_searches").update({
        result_data: finalContacts,
        contacts_found: finalContacts.length,
        contacts_enriched: enrichedCount,
        status: "completed",
        enrich_step: null, enrich_cursor: 0, enrich_run_id: null, enrich_heartbeat: null,
      }).eq("id", searchId);

      console.log(`[lead-enrich] ✅ COMPLETE: ${enrichedCount}/${finalContacts.length} enriched`);
      return jsonResp({ success: true, enriched: enrichedCount, total: finalContacts.length, status: "done" });
    }

    // Save progress and chain to next step
    return await chainNow(nextStep, nextCursor, "step-complete");

  } catch (error) {
    console.error("[lead-enrich] Error:", error);
    try {
      const body2 = await req.clone().json().catch(() => ({}));
      if ((body2 as any)?.searchId) {
        // Set status to "failed" (not "completed") and preserve checkpoint for resume
        await supabase.from("lead_searches").update({ 
          status: "failed",
          error_message: `Enrichment error: ${error instanceof Error ? error.message : "Unknown"}`,
        }).eq("id", (body2 as any).searchId);
      }
    } catch (_) {}
    return jsonResp({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ═══════════════════════════════════════════════════════════
// TIMEOUT WRAPPER
// ═══════════════════════════════════════════════════════════

async function fetchWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs)),
  ]);
}

// ═══════════════════════════════════════════════════════════
// CLEAN INTERNAL FLAGS
// ═══════════════════════════════════════════════════════════

function cleanInternalFlags(contacts: any[]): any[] {
  return contacts.map((c: any) => {
    const clean = { ...c };
    delete clean._apollo_matched; delete clean._site_scraped;
    delete clean._collaborators_found;
    delete clean._expanded_from;
    return clean;
  });
}

// ═══════════════════════════════════════════════════════════
// APPLY ORG CACHE
// ═══════════════════════════════════════════════════════════

function applyOrgCache(contacts: any[], orgCache: Map<string, any>) {
  for (const c of contacts) {
    const d = c._primary_domain || extractDomainFromEmail(c.email) || extractDomainFromWebsite(c.website);
    if (!d) continue;
    const org = orgCache.get(d);
    if (!org) continue;
    if (!c.company && org.name) c.company = org.name;
    if (!c.website && org.website_url) c.website = cleanWebsiteUrl(org.website_url);
    if (!c.city && org.city) c.city = org.city;
    if (!c.revenue && org.estimated_annual_revenue) c.revenue = org.estimated_annual_revenue;
    if (!c.employees_count && org.estimated_num_employees) c.employees_count = org.estimated_num_employees;
    if (!c._apollo_org_id && org.id) c._apollo_org_id = org.id;
    if (org.industry) c.industry = org.industry;
    if (org.short_description) c.company_description = c.company_description || org.short_description;
    if (org.founded_year) c.founding_year = c.founding_year || String(org.founded_year);
    if (org.linkedin_url) c.company_linkedin = c.company_linkedin || org.linkedin_url;
  }
}

// ═══════════════════════════════════════════════════════════
// APOLLO RATE LIMITING — deadline-aware
// ═══════════════════════════════════════════════════════════

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let apolloCallTimestamps: number[] = [];
const apolloCompanyDomainCache = new Map<string, string>();

async function apolloRateLimitedFetch(url: string, options: RequestInit, getTimeRemaining?: () => number): Promise<Response> {
  const now = Date.now();
  apolloCallTimestamps = apolloCallTimestamps.filter((t) => now - t < 60_000);
  if (apolloCallTimestamps.length >= 45) {
    const waitMs = 60_000 - (now - apolloCallTimestamps[0]) + 1000;
    if (getTimeRemaining && waitMs > getTimeRemaining() - 5_000) {
      throw new Error("DEADLINE_CHAIN: rate limit wait exceeds remaining time");
    }
    console.log(`[lead-enrich] Rate limit: waiting ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
  }
  apolloCallTimestamps.push(Date.now());

  // Use a NEW AbortController for each attempt to avoid stale signals on retries
  const doFetch = async (): Promise<Response> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  };

  let resp = await doFetch();
  if (resp.status === 429) {
    // Prefer provider hint; fallback to safer backoff (15s/30s)
    for (let attempt = 1; attempt <= 2; attempt++) {
      const retryAfterHeader = Number(resp.headers.get("retry-after") || "0");
      const fallbackBackoff = attempt * 15_000;
      // Clamp provider hint to avoid huge retry-after values causing instant chain loops
      const retryAfterMs = retryAfterHeader > 0 ? Math.min(retryAfterHeader * 1000, 30_000) : 0;
      const backoff = retryAfterMs > 0 ? retryAfterMs : fallbackBackoff;

      if (getTimeRemaining && (backoff + FETCH_TIMEOUT_MS) > getTimeRemaining() - 5_000) {
        // Treat as persistent 429 (not generic deadline) so caller can apply stronger cooldown logic
        throw new Error("APOLLO_429_PERSISTENT: retry-backoff exceeds remaining time");
      }

      console.log(`[lead-enrich] 429, retrying in ${Math.round(backoff / 1000)}s (attempt ${attempt}/2)`);
      await sleep(backoff);
      apolloCallTimestamps.push(Date.now());
      resp = await doFetch();
      if (resp.status !== 429) break;
    }

    // Never swallow persistent 429 as "no match"; force chain/resume on same cursor
    if (resp.status === 429) {
      throw new Error("APOLLO_429_PERSISTENT: retries exhausted");
    }
  }

  return resp;
}

// ═══════════════════════════════════════════════════════════
// APOLLO ENDPOINTS
// ═══════════════════════════════════════════════════════════

async function apolloPeopleMatch(apiKey: string, contact: any, getTimeRemaining?: () => number): Promise<any | null> {
  try {
    const companyName = (contact.company || contact.organization_name || "").trim();
    const firstLast = splitFirstLastName(contact.name || "");

    let resolvedDomain =
      extractDomainFromWebsite(contact.website) ||
      extractDomainFromEmail(contact.email) ||
      (contact._primary_domain || "") ||
      "";

    if (!resolvedDomain && companyName) {
      const companyKey = companyName.toLowerCase();
      if (apolloCompanyDomainCache.has(companyKey)) {
        resolvedDomain = apolloCompanyDomainCache.get(companyKey) || "";
      } else {
        const domainFromOrg = await apolloResolveCompanyDomain(apiKey, companyName, getTimeRemaining);
        if (domainFromOrg) {
          resolvedDomain = domainFromOrg;
          apolloCompanyDomainCache.set(companyKey, domainFromOrg);
        }
      }
    }

    const tryMatch = async (mutate: (params: URLSearchParams) => void): Promise<any | null> => {
      const params = new URLSearchParams();
      params.set("reveal_personal_emails", "true");
      params.set("reveal_phone_number", "true");
      params.set("run_waterfall_email", "true");
      params.set("run_waterfall_phone", "true");
      mutate(params);
      return await apolloPeopleMatchRequest(apiKey, params, getTimeRemaining);
    };

    if (contact._apollo_person_id) {
      const byId = await tryMatch((params) => params.set("id", contact._apollo_person_id));
      if (byId) return byId;
    }

    if (contact.email && !isGenericEmail(contact.email)) {
      const byEmail = await tryMatch((params) => params.set("email", contact.email));
      if (byEmail) return byEmail;
    }

    if (contact.linkedin_url) {
      const byLinkedin = await tryMatch((params) => params.set("linkedin_url", contact.linkedin_url));
      if (byLinkedin) return byLinkedin;
    }

    if (firstLast.first_name && (resolvedDomain || companyName)) {
      const byName = await tryMatch((params) => {
        params.set("first_name", firstLast.first_name);
        if (firstLast.last_name) params.set("last_name", firstLast.last_name);
        if (resolvedDomain) params.set("domain", resolvedDomain);
        if (companyName) params.set("organization_name", companyName);
      });
      if (byName) return byName;
    }

    const candidate = await apolloFindBestPersonCandidate(apiKey, contact, resolvedDomain, companyName, getTimeRemaining);
    if (candidate?.id) {
      const byFoundId = await tryMatch((params) => params.set("id", candidate.id));
      if (byFoundId) return byFoundId;
      return candidate;
    }

    return null;
  } catch (e) {
    if (e instanceof Error && (e.message.startsWith("DEADLINE_CHAIN") || e.message.startsWith("APOLLO_429_PERSISTENT"))) throw e;
    console.error("[lead-enrich] Match error:", e);
    return null;
  }
}

async function apolloPeopleMatchRequest(
  apiKey: string,
  params: URLSearchParams,
  getTimeRemaining?: () => number,
): Promise<any | null> {
  const resp = await apolloRateLimitedFetch(`https://api.apollo.io/api/v1/people/match?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({}),
  }, getTimeRemaining);

  const data = await resp.json();

  if (resp.status === 429) {
    throw new Error("APOLLO_429_PERSISTENT: match still rate-limited after retries");
  }

  if (!resp.ok || !data?.person) return null;
  const p = data.person;

  const phoneNumbers: any[] = Array.isArray(p.phone_numbers) ? p.phone_numbers : [];
  const preferredPhone = phoneNumbers.find((pn: any) => ["mobile", "direct_dial"].includes((pn?.type || "").toLowerCase()));
  const fallbackPhone = phoneNumbers.find((pn: any) => !!pn?.sanitized_number);
  const bestPhone = (preferredPhone || fallbackPhone)?.sanitized_number || "";

  const personalEmails: string[] = Array.isArray(p.personal_emails) ? p.personal_emails : [];
  const bestEmail = p.email || personalEmails.find((e) => !!e && !isGenericEmail(e)) || personalEmails[0] || "";

  return {
    name: p.name || "",
    email: bestEmail,
    phone: bestPhone,
    linkedin_url: p.linkedin_url || "",
    title: p.title || "",
    seniority: p.seniority || "",
    website: p.organization?.website_url || "",
    primary_domain: p.organization?.primary_domain || "",
    organization_id: p.organization?.id || "",
    revenue: p.organization?.estimated_annual_revenue || "",
    employees_count: p.organization?.estimated_num_employees || "",
  };
}

async function apolloResolveCompanyDomain(
  apiKey: string,
  companyName: string,
  getTimeRemaining?: () => number,
): Promise<string | null> {
  if (!companyName || companyName.trim().length < 2) return null;

  const resp = await apolloRateLimitedFetch("https://api.apollo.io/api/v1/mixed_companies/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({ q_organization_name: companyName, page: 1, per_page: 3 }),
  }, getTimeRemaining);

  const data = await resp.json();
  if (!resp.ok) return null;

  const orgs = data?.organizations || data?.companies || [];
  if (!Array.isArray(orgs) || orgs.length === 0) return null;

  const best = orgs.find((o: any) => !!o?.primary_domain) || orgs[0];
  const domain = (best?.primary_domain || "").toString().trim().toLowerCase();
  return domain || null;
}

async function apolloFindBestPersonCandidate(
  apiKey: string,
  contact: any,
  resolvedDomain: string,
  companyName: string,
  getTimeRemaining?: () => number,
): Promise<any | null> {
  const fullName = (contact.name || "").trim();
  if (!fullName) return null;

  const firstLast = splitFirstLastName(fullName);
  const body: any = { per_page: 10, page: 1, person_titles_current_only: true };
  body.q_keywords = fullName;
  if (resolvedDomain) body.organization_domains = [resolvedDomain];
  if (companyName) body.q_organization_name = companyName;

  const resp = await apolloRateLimitedFetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify(body),
  }, getTimeRemaining);

  const data = await resp.json();
  if (!resp.ok) return null;

  const people = Array.isArray(data?.people) ? data.people : [];
  if (people.length === 0) return null;

  const targetName = normalizeName(fullName);
  const targetCompany = normalizeName(companyName);

  const scored = people.map((p: any) => {
    const candidateName = normalizeName(p.name || `${p.first_name || ""} ${p.last_name || ""}`);
    const candidateCompany = normalizeName(p.organization?.name || "");
    const candidateDomain = (p.organization?.primary_domain || "").toString().toLowerCase();

    let score = 0;
    if (candidateName && targetName && candidateName === targetName) score += 60;
    if (firstLast.first_name && normalizeName(p.first_name || "") === normalizeName(firstLast.first_name)) score += 20;
    if (firstLast.last_name && normalizeName(p.last_name || "") === normalizeName(firstLast.last_name)) score += 20;
    if (resolvedDomain && candidateDomain && resolvedDomain === candidateDomain) score += 35;
    if (targetCompany && candidateCompany && (candidateCompany.includes(targetCompany) || targetCompany.includes(candidateCompany))) score += 20;
    if (p.linkedin_url) score += 5;
    if (p.email) score += 5;

    return { score, person: p };
  });

  scored.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
  const best = scored[0]?.person;
  if (!best?.id) return null;

  return {
    id: best.id || "",
    name: best.name || `${best.first_name || ""} ${best.last_name || ""}`.trim(),
    email: best.email || "",
    phone: best.phone_numbers?.[0]?.sanitized_number || "",
    linkedin_url: best.linkedin_url || "",
    title: best.title || "",
    seniority: best.seniority || "",
    website: best.organization?.website_url || "",
    primary_domain: best.organization?.primary_domain || resolvedDomain || "",
    organization_id: best.organization?.id || "",
    revenue: best.organization?.estimated_annual_revenue || "",
    employees_count: best.organization?.estimated_num_employees || "",
  };
}

function splitFirstLastName(name: string): { first_name: string; last_name: string } {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

function normalizeName(value: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function apolloOrgEnrich(apiKey: string, domain: string, getTimeRemaining?: () => number): Promise<any | null> {
  try {
    const resp = await apolloRateLimitedFetch(`https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`, {
      method: "GET", headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    }, getTimeRemaining);
    const data = await resp.json();
    if (!resp.ok || !data.organization) return null;
    const org = data.organization;
    return {
      id: org.id || "", name: org.name || "", website_url: org.website_url || "",
      city: org.city || org.raw_address || "",
      estimated_num_employees: org.estimated_num_employees || "",
      estimated_annual_revenue: org.estimated_annual_revenue || "",
      industry: org.industry || "", short_description: org.short_description || "",
      founded_year: org.founded_year || "", linkedin_url: org.linkedin_url || "",
      primary_domain: org.primary_domain || domain,
    };
  } catch (e) {
    if (e instanceof Error && (e.message.startsWith("DEADLINE_CHAIN") || e.message.startsWith("APOLLO_429_PERSISTENT"))) throw e;
    console.error("[lead-enrich] Org enrich error:", e);
    return null;
  }
}

async function apolloCollaboratorSearch(apiKey: string, orgId: string, getTimeRemaining?: () => number): Promise<any[]> {
  try {
    const resp = await apolloRateLimitedFetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({
        organization_ids: [orgId], per_page: 25, page: 1,
        person_seniorities: ["owner", "founder", "c_suite", "director", "vp", "manager"],
      }),
    }, getTimeRemaining);
    const data = await resp.json();
    if (!resp.ok || !data.people?.length) return [];
    return data.people.map((p: any) => ({
      name: p.name || "", email: p.email || "",
      phone: p.phone_numbers?.[0]?.sanitized_number || "",
      linkedin_url: p.linkedin_url || "", title: p.title || "",
      seniority: p.seniority || "", _apollo_person_id: p.id || "",
    }));
  } catch (e) {
    if (e instanceof Error && (e.message.startsWith("DEADLINE_CHAIN") || e.message.startsWith("APOLLO_429_PERSISTENT"))) throw e;
    console.error("[lead-enrich] Collaborator error:", e);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════
// FIRECRAWL ENDPOINTS
// ═══════════════════════════════════════════════════════════

async function scrapeCompanyWebsite(apiKey: string, url: string): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          url, formats: ["extract"],
          extract: {
            schema: {
              type: "object",
              properties: {
                description: { type: "string", description: "Descrição ou 'sobre' da empresa" },
                services: { type: "string", description: "Serviços ou produtos oferecidos" },
                phone: { type: "string", description: "Telefone principal com DDD" },
                email: { type: "string", description: "Email de contato principal" },
                address: { type: "string", description: "Endereço completo" },
                instagram: { type: "string", description: "Link ou @ do Instagram" },
                facebook: { type: "string", description: "Link do Facebook" },
                whatsapp: { type: "string", description: "Número de WhatsApp" },
                employees_approx: { type: "string", description: "Número aproximado de funcionários" },
                founding_year: { type: "string", description: "Ano de fundação" },
              },
            },
            prompt: "Extraia informações de contato e sobre a empresa. Procure em rodapé, contato, sobre nós. NÃO extraia dados mascarados.",
          },
          onlyMainContent: false, timeout: 20000,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) return null;
      const extract = data.data?.extract || data.extract || null;
      if (extract) {
        if (extract.phone) {
          const d = extract.phone.replace(/\D/g, "");
          if (/[x*]{3,}/i.test(extract.phone) || d.length < 8 || isPlaceholderPhone(d)) extract.phone = "";
        }
        if (extract.whatsapp) {
          const d = extract.whatsapp.replace(/\D/g, "");
          if (d.length < 8 || isPlaceholderPhone(d)) extract.whatsapp = "";
        }
        if (extract.email && (/\*{2,}/.test(extract.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extract.email))) extract.email = "";
      }
      return extract;
    } finally {
      clearTimeout(timeout);
    }
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════
// FIRECRAWL FALLBACK — recover site/email/phone when Apollo is rate-limited
// ═══════════════════════════════════════════════════════════

async function discoverCompanyDataViaFirecrawl(apiKey: string, contact: any, searchConfig: any): Promise<any | null> {
  const company = (contact.company || contact.organization_name || "").trim();
  if (!company || company.length < 2) return null;

  const cityHint = (contact.city || searchConfig?.location?.person_locations?.[0] || searchConfig?.location?.org_locations?.[0] || "").toString().trim();
  const query = `${company}${cityHint ? ` ${cityHint}` : ""} site oficial contato telefone email`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        query,
        limit: 2,
        lang: "pt-br",
        country: searchConfig?.location?.country || "BR",
        scrapeOptions: {
          formats: ["extract"],
          extract: {
            schema: {
              type: "object",
              properties: {
                contacts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      company: { type: "string" },
                      website: { type: "string" },
                      email: { type: "string" },
                      phone: { type: "string" },
                      city: { type: "string" },
                      company_description: { type: "string" },
                      instagram: { type: "string" },
                      linkedin_url: { type: "string" },
                    },
                  },
                },
              },
            },
            prompt: `Extraia contato da empresa alvo "${company}". Priorize dados exatos do site oficial: website, email, telefone e breve descrição.`,
          },
        },
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const pages = data.data || [];

    const normalize = (v: string) => (v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const companyNorm = normalize(company);
    const companyTokens = companyNorm.split(" ").filter((t) => t.length > 2);

    const candidates: any[] = [];
    for (const p of pages) {
      const extract = p.extract || p.json || p.data?.json || {};
      const items = Array.isArray(extract.contacts) ? extract.contacts : [];
      for (const item of items) {
        const merged = { ...item };
        if (!merged.website && p.url) merged.website = p.url;
        candidates.push(merged);
      }
    }

    if (candidates.length === 0) {
      const firstUrl = pages.find((p: any) => typeof p?.url === "string" && p.url.length > 0)?.url;
      if (!firstUrl) return null;

      // At minimum recover official website so downstream scrape step can enrich phone/email
      const fallbackWebsite = cleanWebsiteUrl(firstUrl);
      if (!fallbackWebsite || /google\.|bing\.|yahoo\.|duckduckgo\./i.test(fallbackWebsite)) return null;

      console.log(`[lead-enrich] Firecrawl fallback recovered website-only for "${company}": ${fallbackWebsite}`);
      return {
        website: fallbackWebsite,
        email: "",
        phone: "",
        city: "",
        company_description: "",
        instagram: "",
        linkedin_url: "",
      };
    }

    const scoreCandidate = (c: any) => {
      const cName = normalize(c.company || "");
      if (!cName) return 0;
      let score = 0;
      for (const t of companyTokens) if (cName.includes(t)) score += 1;
      if (cName === companyNorm) score += 3;
      return score;
    };

    candidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
    const best = candidates[0] || null;
    if (!best) return null;

    const rawPhone = (best.phone || "").toString().trim();
    let phone = rawPhone;
    if (phone) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 8 || isPlaceholderPhone(digits) || /[x*]{3,}/i.test(phone)) phone = "";
    }

    const rawEmail = (best.email || "").toString().trim();
    const email = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) && !/\*{2,}/.test(rawEmail) ? rawEmail : "";

    const website = best.website ? cleanWebsiteUrl(best.website) : "";
    const company_description = (best.company_description || "").toString();

    if (!website && !email && !phone) return null;

    console.log(`[lead-enrich] Firecrawl fallback recovered for "${company}": website=${!!website}, email=${!!email}, phone=${!!phone}`);

    return {
      website,
      email,
      phone,
      city: (best.city || "").toString(),
      company_description,
      instagram: (best.instagram || "").toString(),
      linkedin_url: (best.linkedin_url || "").toString(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ═══════════════════════════════════════════════════════════
// AI SUMMARY
// ═══════════════════════════════════════════════════════════

async function generateAISummaries(apiKey: string, contacts: any[], searchConfig: any): Promise<any[]> {
  const industry = searchConfig?.company?.industries?.join(", ") || searchConfig?.query || "setor não especificado";
  const contactDescriptions = contacts.map((c: any, i: number) => {
    const parts = [`Lead ${i + 1}:`];
    if (c.name) parts.push(`Nome: ${c.name}`);
    if (c.title) parts.push(`Cargo: ${c.title}`);
    if (c.seniority) parts.push(`Senioridade: ${c.seniority}`);
    if (c.company || c.organization_name) parts.push(`Empresa: ${c.company || c.organization_name}`);
    if (c.industry) parts.push(`Indústria: ${c.industry}`);
    if (c.city) parts.push(`Cidade: ${c.city}`);
    if (c.website) parts.push(`Site: ${c.website}`);
    if (c.revenue) parts.push(`Receita: ${c.revenue}`);
    if (c.employees_count) parts.push(`Funcionários: ${c.employees_count}`);
    if (c.company_description) parts.push(`Sobre: ${c.company_description}`);
    if (c.company_services) parts.push(`Serviços: ${c.company_services}`);
    if (c._source === "expansion") parts.push(`[Descoberto via expansão]`);
    return parts.join(" | ");
  }).join("\n\n");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você é um analista de leads B2B. Para cada lead, gere resumo executivo conciso. Responda APENAS com JSON válido." },
        { role: "user", content: `Analise ${contacts.length} leads do setor "${industry}". Para cada:\n- summary: resumo 2-3 frases\n- tags: array 2-4 tags\n- relevance_score: 0-100\n- insights: 1 insight acionável\n\n${contactDescriptions}\n\nResponda com array JSON de ${contacts.length} objetos na mesma ordem.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_lead_summaries",
          description: "Return AI-generated summaries for each lead",
          parameters: {
            type: "object",
            properties: {
              summaries: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    summary: { type: "string" }, tags: { type: "array", items: { type: "string" } },
                    relevance_score: { type: "number" }, insights: { type: "string" },
                  },
                  required: ["summary", "tags", "relevance_score", "insights"],
                },
              },
            },
            required: ["summaries"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_lead_summaries" } },
    }),
  });

  if (!resp.ok) { const t = await resp.text(); console.error("[lead-enrich] AI error:", resp.status, t); throw new Error(`AI error ${resp.status}`); }
  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    const parsed = JSON.parse(toolCall.function.arguments);
    return parsed.summaries || [];
  }
  const content = data.choices?.[0]?.message?.content || "";
  try { const parsed = JSON.parse(content); return Array.isArray(parsed) ? parsed : parsed.summaries || []; }
  catch { console.error("[lead-enrich] Failed to parse AI response"); return []; }
}

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

function cleanWebsiteUrl(url: string): string {
  if (!url) return "";
  try { const u = new URL(url.startsWith("http") ? url : `https://${url}`); return `${u.protocol}//${u.hostname}`; }
  catch { return url; }
}

function extractDomainFromEmail(email: string | undefined): string | null {
  if (!email || isGenericEmail(email)) return null;
  const domain = email.split("@")[1];
  if (!domain) return null;
  const free = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "live.com", "msn.com", "aol.com", "protonmail.com", "zoho.com", "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br"];
  if (free.includes(domain.toLowerCase())) return null;
  return domain;
}

function extractDomainFromWebsite(website: string | undefined): string | null {
  if (!website) return null;
  try { const u = new URL(website.startsWith("http") ? website : `https://${website}`); return u.hostname.replace(/^www\./, ""); }
  catch { return null; }
}

function isGenericEmail(email: string): boolean {
  if (!email) return true;
  const prefix = email.split("@")[0].toLowerCase();
  const generic = ["contato", "contact", "info", "comercial", "vendas", "sales", "atendimento", "suporte", "support", "sac", "adm", "admin", "financeiro", "rh", "marketing", "compras", "geral", "noreply", "no-reply", "hello", "office", "mail", "email"];
  return generic.some((g) => prefix === g || prefix.startsWith(g + "."));
}

function isPlaceholderPhone(digits: string): boolean {
  let local = digits;
  if (local.startsWith("55") && local.length > 11) local = local.slice(2);
  const sub = local.length === 11 ? local.slice(3) : local.slice(2);
  if (/^1234|^2345|^3456|^4567|^5678|^6789|^7890/.test(sub)) return true;
  if (/^9876|^8765|^7654|^6543|^5432|^4321/.test(sub)) return true;
  if (/^(\d)\1{5,}$/.test(sub)) return true;
  const digitCounts = new Map<string, number>();
  for (const d of sub) digitCounts.set(d, (digitCounts.get(d) || 0) + 1);
  const maxRepeat = Math.max(...digitCounts.values());
  if (maxRepeat >= 6 && sub.length <= 8) return true;
  if (["12345678", "87654321", "98765432", "88888888", "99999999", "00000000"].includes(sub)) return true;
  return false;
}

function isCompanyLinkedIn(url: string): boolean {
  if (!url) return false;
  return /linkedin\.com\/company\//i.test(url);
}
