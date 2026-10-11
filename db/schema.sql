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
CREATE OR REPLACE FUNCTION scrapper.create_scan(candidate jsonb, hourly_budget numeric) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE prior jsonb; stamp bigint := (candidate->>'createdAt')::bigint; own text := candidate->>'owner';
BEGIN
 PERFORM pg_advisory_xact_lock(839122,1);
 DELETE FROM scrapper.scans WHERE created < stamp-86400000;
 SELECT body INTO prior FROM scrapper.scans WHERE owner=own AND
 (idem=candidate->>'key' OR (description=candidate->>'description' AND mode=candidate->>'mode' AND created>stamp-120000)) ORDER BY created DESC LIMIT 1;
 IF prior IS NOT NULL THEN
  IF prior->>'key'=candidate->>'key' AND (prior->>'description'<>candidate->>'description' OR prior->>'mode'<>candidate->>'mode') THEN
   RETURN jsonb_build_object('error','This run key belongs to another request. Start a new search.','status',409);
  END IF;
  RETURN prior;
 END IF;
 IF EXISTS(SELECT 1 FROM scrapper.scans WHERE owner=own AND stage NOT IN ('complete','empty','partial','failed') AND created>stamp-210000) THEN
  RETURN jsonb_build_object('error','You already have a search in progress. Finish it before starting another.','status',429);
 END IF;
 IF (SELECT count(*) FROM scrapper.scans WHERE owner=own AND created>stamp-3600000)>=20 THEN
  RETURN jsonb_build_object('error','This session has reached its hourly search limit. Try again later.','status',429);
 END IF;
 IF candidate->>'mode'='live' AND (SELECT coalesce(sum(reserved),0) FROM scrapper.scans WHERE mode='live' AND created>stamp-3600000)+(candidate->>'reservedUsd')::numeric>hourly_budget THEN
  RETURN jsonb_build_object('error','The server has reached its hourly live-search budget. No provider job was started.','status',429);
 END IF;
 INSERT INTO scrapper.scans(id,owner,idem,mode,description,stage,created,reserved,body)
 VALUES(candidate->>'id',own,candidate->>'key',candidate->>'mode',candidate->>'description',candidate->>'stage',stamp,(candidate->>'reservedUsd')::numeric,candidate);
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
