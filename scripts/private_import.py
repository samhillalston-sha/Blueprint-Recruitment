#!/usr/bin/env python3
"""Validate private CSV; optionally produce an atomic, RLS-guarded SQL import.
No network access, credentials, real fixture data or source-value logging.
"""
import argparse
import csv
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit
from uuid import UUID

PROJECT_REF = 'ldrdsvsmwnjzhyzqdcdt'
TEXT_FIELDS = {'full_name':120,'email':254,'phone':40,'social_url':500,'location':120,'teams':500,'position':7}
NUMERIC_FIELDS = {'age':(16,100),'height_cm':(100,250)}
COLUMNS = {'source_id','prospect_id',*TEXT_FIELDS,*NUMERIC_FIELDS}
class ImportErrorSafe(ValueError):
    pass

def uuid_value(value):
    try:
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise ImportErrorSafe('Use a valid UUID for the actor, season or existing prospect.') from None

def load_rows(path, expected_count=10):
    if not 1 <= expected_count <= 10:
        raise ImportErrorSafe('Expected count must be between one and ten.')
    rows=[]
    try:
        with open(path, encoding='utf-8-sig', newline='') as source:
            reader=csv.DictReader(source, strict=True)
            headers=reader.fieldnames or []
            if len(headers)!=len(set(headers)) or not {'source_id','full_name'} <= set(headers) or set(headers)-COLUMNS:
                raise ImportErrorSafe('Use unique supported headers including source_id and full_name.')
            seen=set()
            for number,raw in enumerate(reader,start=2):
                if None in raw or any(value is None for value in raw.values()):
                    raise ImportErrorSafe(f'CSV row {number} has missing or extra columns.')
                if number>11:
                    raise ImportErrorSafe('Import at most ten rows per batch.')
                source_id=raw['source_id'].strip()
                if not source_id or len(source_id)>120 or source_id in seen:
                    raise ImportErrorSafe(f'CSV row {number}: source_id must be unique, nonempty and at most 120 characters.')
                seen.add(source_id)
                facts={}
                for field,maximum in TEXT_FIELDS.items():
                    value=raw.get(field,'').strip()
                    if len(value)>maximum or (field=='full_name' and not value):
                        raise ImportErrorSafe(f'CSV row {number}: check {field}.')
                    facts[field]=value or None
                for field,(minimum,maximum) in NUMERIC_FIELDS.items():
                    value=raw.get(field,'').strip()
                    if value and (not re.fullmatch(r'[0-9]+',value) or not minimum<=int(value)<=maximum):
                        raise ImportErrorSafe(f'CSV row {number}: check {field} whole-number range.')
                    facts[field]=int(value) if value else None
                if facts['position'] not in (None,'Handler','Cutter'):
                    raise ImportErrorSafe(f'CSV row {number}: position must be Handler, Cutter or blank.')
                if facts['email'] and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',facts['email']):
                    raise ImportErrorSafe(f'CSV row {number}: check email.')
                if facts['social_url']:
                    try:
                        url=urlsplit(facts['social_url'])
                        valid=url.scheme in ('http','https') and bool(url.hostname) and not url.username and not url.password
                    except ValueError:
                        valid=False
                    if not valid:
                        raise ImportErrorSafe(f'CSV row {number}: use a complete HTTP(S) social_url without credentials.')
                row={'source_id':source_id,'facts':facts}
                if raw.get('prospect_id','').strip():
                    row['prospect_id']=uuid_value(raw['prospect_id'].strip())
                rows.append(row)
    except (OSError, UnicodeError, csv.Error):
        raise ImportErrorSafe('Could not read a valid UTF-8 CSV. Source values are not logged.') from None
    if len(rows)!=expected_count:
        raise ImportErrorSafe(f'Expected {expected_count} rows; found {len(rows)}. Nothing written.')
    return rows

def build_sql(rows,actor_id,season_id,batch_id,project_ref):
    if project_ref!=PROJECT_REF:
        raise ImportErrorSafe('Project reference does not match the private recruiting project.')
    actor=uuid_value(actor_id);season=uuid_value(season_id)
    if not re.fullmatch(r'[a-z0-9][a-z0-9._-]{0,79}',batch_id):
        raise ImportErrorSafe('Use a stable lowercase batch ID with letters, numbers, dots, underscores or hyphens.')
    # SQL quoting and standard_conforming_strings avoid string/command injection.
    quoted=lambda value:"'"+value.replace("'","''")+"'"
    payload=quoted(json.dumps(rows,ensure_ascii=False,separators=(',',':')))
    return f'''-- PRIVATE INPUT: never commit or publish this generated file.
-- Run only in Supabase project {PROJECT_REF}, as its authorized administrator.
begin;
set local standard_conforming_strings=on;
select set_config('request.jwt.claim.sub','{actor}',true);
select set_config('request.jwt.claims','{{"sub":"{actor}","role":"authenticated"}}',true);
set local role authenticated;
select public.import_prospects('{season}'::uuid,{quoted(batch_id)},{payload}::jsonb) as import_summary;
commit;
'''

def write_private_sql(path,sql):
    destination=Path(path).expanduser().resolve()
    root=Path(__file__).resolve().parents[1]
    if destination.is_relative_to(root) and not destination.is_relative_to(root/'data/private'):
        raise ImportErrorSafe('Write private SQL outside the repository or under ignored data/private/.')
    destination.parent.mkdir(parents=True,exist_ok=True)
    # Exclusive creation prevents accidentally overwriting a private input/export.
    fd=os.open(destination,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w',encoding='utf-8') as output:
        output.write(sql)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file',required=True)
    parser.add_argument('--expected-count',type=int,default=10)
    parser.add_argument('--write-sql',action='store_true')
    parser.add_argument('--output')
    parser.add_argument('--actor-id')
    parser.add_argument('--season-id')
    parser.add_argument('--batch-id')
    parser.add_argument('--project-ref')
    args=parser.parse_args()
    try:
        rows=load_rows(args.file,args.expected_count)
        if args.write_sql:
            if not all([args.output,args.actor_id,args.season_id,args.batch_id,args.project_ref]):
                raise ImportErrorSafe('SQL preparation requires output, actor-id, season-id, batch-id and project-ref.')
            write_private_sql(args.output,build_sql(rows,args.actor_id,args.season_id,args.batch_id,args.project_ref))
            print(json.dumps({'validated':len(rows),'private_sql_written':True,'database_changed':False}))
        else:
            print(json.dumps({'validated':len(rows),'database_changed':False}))
    except (ImportErrorSafe,OSError):
        # Never print OS paths, source values or database credentials.
        error=sys.exception()
        print(str(error) if isinstance(error,ImportErrorSafe) else 'Could not create the private SQL file; it may already exist.',file=sys.stderr)
        return 1
    return 0

if __name__=='__main__':
    raise SystemExit(main())
