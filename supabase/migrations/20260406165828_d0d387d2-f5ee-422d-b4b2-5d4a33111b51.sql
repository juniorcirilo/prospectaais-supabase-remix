CREATE OR REPLACE FUNCTION public.upsert_lead_contact(
  p_name text,
  p_phone text,
  p_company text DEFAULT ''::text,
  p_city text DEFAULT ''::text,
  p_tags text[] DEFAULT '{}'::text[],
  p_list_id uuid DEFAULT NULL::uuid,
  p_custom_fields jsonb DEFAULT '{}'::jsonb,
  p_score integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_id uuid;
  v_existing_name text;
  v_is_new boolean := false;
  v_result jsonb;
BEGIN
  -- Match 1: by phone (primary)
  IF p_phone IS NOT NULL AND p_phone <> '' THEN
    SELECT id, name INTO v_existing_id, v_existing_name
    FROM contacts WHERE phone = p_phone LIMIT 1;
    
    -- If phone matches but name is clearly different, skip phone dedup (different person, same company number)
    IF v_existing_id IS NOT NULL
       AND p_name IS NOT NULL AND p_name <> '' AND p_name <> 'Sem nome'
       AND v_existing_name IS NOT NULL AND v_existing_name <> '' AND v_existing_name <> 'Sem nome'
       AND LOWER(p_name) <> LOWER(v_existing_name)
    THEN
      v_existing_id := NULL; -- force new insert
    END IF;
  END IF;

  -- Match 2: by name+company+list (secondary, only if no phone match)
  IF v_existing_id IS NULL AND p_name IS NOT NULL AND p_name <> '' AND p_company IS NOT NULL AND p_company <> '' THEN
    SELECT id INTO v_existing_id FROM contacts
    WHERE LOWER(name) = LOWER(p_name) AND LOWER(COALESCE(company, '')) = LOWER(p_company) AND list_id IS NOT DISTINCT FROM p_list_id
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    -- Update only NULL/empty fields (merge)
    UPDATE contacts SET
      name = CASE WHEN (contacts.name IS NULL OR contacts.name = '' OR contacts.name = 'Sem nome') AND p_name <> '' THEN p_name ELSE contacts.name END,
      phone = CASE WHEN (contacts.phone IS NULL OR contacts.phone = '') AND p_phone <> '' THEN p_phone ELSE contacts.phone END,
      company = CASE WHEN (contacts.company IS NULL OR contacts.company = '') AND p_company <> '' THEN p_company ELSE contacts.company END,
      city = CASE WHEN (contacts.city IS NULL OR contacts.city = '') AND p_city <> '' THEN p_city ELSE contacts.city END,
      tags = CASE WHEN contacts.tags IS NULL OR contacts.tags = '{}' THEN p_tags ELSE contacts.tags END,
      custom_fields = contacts.custom_fields || p_custom_fields,
      updated_at = now()
    WHERE id = v_existing_id;
    v_is_new := false;
  ELSE
    -- Insert new
    INSERT INTO contacts (name, phone, company, city, tags, list_id, custom_fields, score, status)
    VALUES (COALESCE(NULLIF(p_name, ''), 'Sem nome'), p_phone, p_company, p_city, p_tags, p_list_id, p_custom_fields, p_score, 'novo')
    RETURNING id INTO v_existing_id;
    v_is_new := true;
  END IF;

  v_result := jsonb_build_object('id', v_existing_id, 'is_new', v_is_new);
  RETURN v_result;
END;
$$;