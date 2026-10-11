CREATE SCHEMA IF NOT EXISTS scrapper;
-- statement
REVOKE ALL ON SCHEMA scrapper FROM PUBLIC;
-- statement
CREATE TABLE IF NOT EXISTS scrapper.scans (
 id text PRIMARY KEY, owner text NOT NULL, idem text NOT NULL, mode text NOT NULL,
 description text NOT NULL, stage text NOT NULL, created bigint NOT NULL,
 reserved numeric NOT NULL, body jsonb NOT NULL, lease bigint NOT NULL DEFAULT 0,
 UNIQUE(owner, idem)
);
-- statement
CREATE INDEX IF NOT EXISTS scan_owner ON scrapper.scans(owner, created);
-- statement
REVOKE ALL ON scrapper.scans FROM PUBLIC;
-- statement
ALTER TABLE scrapper.scans ADD COLUMN IF NOT EXISTS ip_hash text;
-- statement
CREATE TABLE IF NOT EXISTS scrapper.request_limits (ip_hash text NOT NULL, minute bigint NOT NULL, used integer NOT NULL, PRIMARY KEY(ip_hash,minute));
-- statement
REVOKE ALL ON scrapper.request_limits FROM PUBLIC;
-- statement
CREATE TABLE IF NOT EXISTS scrapper.free_usage (owner text PRIMARY KEY, scan_id text NOT NULL, consumed boolean NOT NULL DEFAULT false);
-- statement
REVOKE ALL ON scrapper.free_usage FROM PUBLIC;
-- statement
CREATE TABLE IF NOT EXISTS scrapper.source_usage (source text NOT NULL, month text NOT NULL, used integer NOT NULL, PRIMARY KEY(source,month));
-- statement
REVOKE ALL ON scrapper.source_usage FROM PUBLIC;
-- statement
CREATE OR REPLACE FUNCTION scrapper.create_scan(candidate jsonb, hourly_budget numeric) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE prior jsonb; stamp bigint := (candidate->>'createdAt')::bigint; own text := candidate->>'owner'; usage_month text := to_char(to_timestamp(stamp/1000.0) AT TIME ZONE 'UTC','YYYY-MM'); run_limit integer := coalesce((candidate->>'xMonthlyRunLimit')::integer,5); fingerprint text := candidate->'admission'->>'ipHash'; daily_budget numeric := coalesce((candidate->'admission'->>'dailyBudget')::numeric,hourly_budget); developer boolean := coalesce((candidate->>'developer')::boolean,false);
BEGIN
 PERFORM pg_advisory_xact_lock(839122,1);
 candidate := candidate - 'admission';
 DELETE FROM scrapper.scans WHERE created < stamp-86400000;
 SELECT body INTO prior FROM scrapper.scans WHERE owner=own AND
 (idem=candidate->>'key' OR (NOT developer AND description=candidate->>'description' AND mode=candidate->>'mode' AND coalesce(body->'sources','["reddit"]'::jsonb)=coalesce(candidate->'sources','["reddit"]'::jsonb) AND coalesce((body->>'developer')::boolean,false)=developer AND created>stamp-120000 AND NOT (stage='failed' AND coalesce((body->>'free')::boolean,false) AND NOT coalesce((body->>'startAttempted')::boolean,false)))) ORDER BY created DESC LIMIT 1;
 IF prior IS NOT NULL THEN
  IF prior->>'key'=candidate->>'key' AND (prior->>'description'<>candidate->>'description' OR prior->>'mode'<>candidate->>'mode' OR coalesce(prior->'sources','["reddit"]'::jsonb)<>coalesce(candidate->'sources','["reddit"]'::jsonb)) THEN
   RETURN jsonb_build_object('error','This run key belongs to another request. Start a new search.','status',409);
  END IF;
  RETURN prior;
 END IF;
 IF NOT developer THEN
 IF EXISTS(SELECT 1 FROM scrapper.scans WHERE owner=own AND NOT coalesce((body->>'developer')::boolean,false) AND stage NOT IN ('complete','empty','partial','failed') AND created>stamp-210000) THEN
  RETURN jsonb_build_object('error','You already have a search in progress. Finish it before starting another.','status',429);
 END IF;
 IF (SELECT count(*) FROM scrapper.scans WHERE owner=own AND NOT coalesce((body->>'developer')::boolean,false) AND created>stamp-3600000)>=20 THEN
  RETURN jsonb_build_object('error','This session has reached its hourly search limit. Try again later.','status',429);
 END IF;
 IF coalesce((candidate->>'free')::boolean,false) AND EXISTS(SELECT 1 FROM scrapper.free_usage WHERE owner=own AND consumed) THEN
  RETURN jsonb_build_object('error','Your free search has already been used. Saved results are available for 24 hours after your search.','status',403);
 END IF;
 IF candidate->>'mode'='live' AND (SELECT count(*) FROM scrapper.scans WHERE mode='live' AND NOT coalesce((body->>'developer')::boolean,false) AND created>stamp-3600000 AND (owner=own OR (fingerprint IS NOT NULL AND ip_hash=fingerprint)))>=10 THEN
  RETURN jsonb_build_object('error','This connection has reached its limit of ten live searches per hour. Try again in an hour.','status',429);
 END IF;
 IF candidate->>'mode'='live' AND (SELECT coalesce(sum(reserved),0) FROM scrapper.scans WHERE mode='live' AND NOT coalesce((body->>'developer')::boolean,false) AND created>stamp-86400000)+(candidate->>'reservedUsd')::numeric>daily_budget THEN
  RETURN jsonb_build_object('error','Today''s research capacity is full. Try again tomorrow; no source job was started.','status',429);
 END IF;
 IF candidate->>'mode'='live' AND (SELECT coalesce(sum(reserved),0) FROM scrapper.scans WHERE mode='live' AND NOT coalesce((body->>'developer')::boolean,false) AND created>stamp-3600000)+(candidate->>'reservedUsd')::numeric>hourly_budget THEN
  RETURN jsonb_build_object('error','Research capacity is full for this hour. Try again in an hour; no source job was started.','status',429);
 END IF;
 END IF; -- developer runs bypass visitor admission quotas
 IF candidate->>'mode'='live' AND candidate->'sources' ? 'x' AND EXISTS(SELECT 1 FROM scrapper.scans WHERE mode='live' AND stage NOT IN ('complete','empty','partial','failed') AND created>stamp-210000 AND body->'sources' ? 'x') THEN
  RETURN jsonb_build_object('error','The X source already has a job in progress. Wait for it to finish before starting another.','status',429);
 END IF;
 IF candidate->>'mode'='live' AND candidate->'sources' ? 'x' THEN
  IF run_limit < 1 OR run_limit > 1000 THEN RETURN jsonb_build_object('error','The X pilot run allowance is not configured correctly.','status',503); END IF;
  IF coalesce((SELECT used FROM scrapper.source_usage WHERE source='x' AND month=usage_month),0)>=run_limit THEN
   RETURN jsonb_build_object('error','The X pilot has reached its monthly run allowance. Reddit and sample mode remain available.','status',429);
  END IF;
  INSERT INTO scrapper.source_usage(source,month,used) VALUES('x',usage_month,1) ON CONFLICT(source,month) DO UPDATE SET used=scrapper.source_usage.used+1;
 END IF;
 INSERT INTO scrapper.scans(id,owner,idem,mode,description,stage,created,reserved,body,ip_hash)
 VALUES(candidate->>'id',own,candidate->>'key',candidate->>'mode',candidate->>'description',candidate->>'stage',stamp,(candidate->>'reservedUsd')::numeric,candidate,fingerprint);
 IF coalesce((candidate->>'free')::boolean,false) AND NOT developer THEN
  INSERT INTO scrapper.free_usage(owner,scan_id,consumed) VALUES(own,candidate->>'id',false) ON CONFLICT(owner) DO UPDATE SET scan_id=excluded.scan_id,consumed=false;
 END IF;
 RETURN candidate;
END $$;
-- statement
CREATE OR REPLACE FUNCTION scrapper.feedback(scan_id text, own text, result_id text, action text, val boolean, stamp bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE item jsonb; idx integer; field text;
BEGIN
 SELECT body INTO item FROM scrapper.scans WHERE id=scan_id AND owner=own AND created>stamp-86400000 FOR UPDATE;
 IF item IS NULL THEN RETURN jsonb_build_object('error','Search not found or expired.','status',404); END IF;
 IF item->>'stage' NOT IN ('complete','empty','partial','failed') THEN RETURN jsonb_build_object('error','Wait until this search finishes before saving feedback.','status',409); END IF;
 IF action NOT IN ('save','irrelevant') THEN RETURN jsonb_build_object('error','Choose a valid feedback action.','status',400); END IF;
 SELECT ordinality-1 INTO idx FROM jsonb_array_elements(item->'results') WITH ORDINALITY WHERE value->>'id'=result_id;
 IF idx IS NULL THEN RETURN jsonb_build_object('error','Result not found.','status',404); END IF;
 field := CASE WHEN action='save' THEN 'saved' ELSE 'irrelevant' END;
 item := jsonb_set(item, ARRAY['results',idx::text,field],to_jsonb(val));
 item := jsonb_set(item, ARRAY['updatedAt'],to_jsonb(stamp));
 UPDATE scrapper.scans SET body=item WHERE id=scan_id AND owner=own;
 RETURN item;
END $$;
-- statement
REVOKE ALL ON FUNCTION scrapper.create_scan(jsonb,numeric) FROM PUBLIC;
-- statement
REVOKE ALL ON FUNCTION scrapper.feedback(text,text,text,text,boolean,bigint) FROM PUBLIC;
