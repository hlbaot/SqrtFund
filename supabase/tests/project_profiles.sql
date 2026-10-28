begin;
do $$
declare r jsonb; t text='0x1010101010101010101010101010101010101010'; w text='0x2020202020202020202020202020202020202020';
begin
  if has_table_privilege('anon','public.project_profiles','SELECT') or has_table_privilege('authenticated','public.project_profiles','UPDATE') or has_function_privilege('anon','public.save_project_profile(text,bigint,text,integer,jsonb,jsonb)','EXECUTE') then raise exception 'public profile database access';end if;
  r=public.save_project_profile(t,1,w,0,'{"leadName":"Fixture"}',null);
  if r->>'status'<>'OK' or r->'document'->>'revision'<>'1' then raise exception 'initial save failed';end if;
  r=public.save_project_profile(t,1,w,0,'{}',null);
  if r->>'status'<>'CONFLICT' then raise exception 'replayed creation accepted';end if;
  r=public.save_project_profile(t,1,w,1,'{"leadName":"Updated"}','{"text":"Delivered kits","evidenceUrl":"https://example.test/report"}');
  if r->'document'->>'revision'<>'2' or jsonb_array_length(r->'document'->'reports')<>1 or r->'document'->'reports'->0->>'publishedAt' is null then raise exception 'report not persisted';end if;
  r=public.save_project_profile(t,1,w,1,'{}','{"text":"Duplicate","evidenceUrl":""}');
  if r->>'status'<>'CONFLICT' then raise exception 'stale signature revision accepted';end if;
  r=public.save_project_profile(t,1,'0x3030303030303030303030303030303030303030',2,'{}',null);
  if r->>'status'<>'CONFLICT' then raise exception 'owner changed';end if;
  r=public.save_project_profile(t,1,w,2,'{"leadName":"Current"}',null);
  if r->'document'->>'revision'<>'3' or r->'document'->'reports'->0->>'text'<>'Delivered kits' then raise exception 'report history lost';end if;
end $$;
rollback;
