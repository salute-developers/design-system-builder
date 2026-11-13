#!/usr/bin/env python3
"""Изолированное сравнение форм SQL. Требует Docker и локальный postgres:17-alpine."""
import argparse
import json
import math
from pathlib import Path
import statistics
import subprocess
import time
import uuid


def docker(*args, data=None):
    return subprocess.run(['docker', *args], input=data, text=True, capture_output=True, check=True).stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--repeats', type=int, default=20)
    args = parser.parse_args()
    if args.repeats < 20:
        parser.error('Нужно минимум 20 измерений')
    name = 'ds-query-perf-' + uuid.uuid4().hex[:10]
    docker('run', '--rm', '-d', '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
           'postgres:17-alpine')
    try:
        for _ in range(60):
            try:
                docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres')
                break
            except subprocess.CalledProcessError:
                time.sleep(.5)
        else:
            raise RuntimeError('PostgreSQL не готов')

        def sql(text):
            return docker('exec', '-i', name, 'psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', data=text)

        sql('''
CREATE TABLE token_values(id bigint PRIMARY KEY, design_system_id int, tenant_id int, token_id int);
CREATE TABLE token_value_revisions(token_value_id bigint, design_system_id int,
 version_sequence_number bigint, deleted boolean NOT NULL DEFAULT false, value jsonb);
CREATE INDEX revision_lookup ON token_value_revisions(token_value_id, version_sequence_number DESC);
CREATE INDEX value_owner ON token_values(design_system_id, id);
INSERT INTO token_values SELECT n, (n-1)/9600, (n-1)/9600, (n-1)%1700 FROM generate_series(1,134400) n;
INSERT INTO token_value_revisions SELECT id, design_system_id, v, false, jsonb_build_array(id)
 FROM token_values CROSS JOIN (VALUES (0), (2)) versions(v);
ANALYZE;
''')
        old = '''SELECT e.id, r.value FROM token_values e JOIN token_value_revisions r
 ON r.token_value_id=e.id WHERE e.tenant_id=0 AND NOT r.deleted AND r.version_sequence_number<=1
 AND r.version_sequence_number=(SELECT max(c.version_sequence_number) FROM token_value_revisions c
 WHERE c.token_value_id=r.token_value_id AND c.version_sequence_number<=1)'''
        lateral = '''SELECT e.id,r.value FROM token_values e JOIN LATERAL
 (SELECT * FROM token_value_revisions c WHERE c.token_value_id=e.id AND c.version_sequence_number<=1
 ORDER BY c.version_sequence_number DESC LIMIT 1) r ON true
 WHERE e.design_system_id=0 AND e.tenant_id=0 AND NOT r.deleted'''
        batch = '''SELECT id,value FROM (SELECT DISTINCT ON(e.id) e.id,r.value,r.deleted
 FROM token_values e JOIN token_value_revisions r ON r.token_value_id=e.id
 WHERE e.design_system_id=0 AND e.tenant_id=0 AND r.version_sequence_number<=1
 ORDER BY e.id,r.version_sequence_number DESC) selected WHERE NOT deleted'''

        def journal(changed):
            candidates = '''JOIN (SELECT DISTINCT token_value_id FROM token_value_revisions
 WHERE design_system_id=0 AND version_sequence_number>0 AND version_sequence_number<=1) c
 ON c.token_value_id=e.id''' if changed else ''
            return f'''SELECT e.id,p.value,n.value FROM token_values e {candidates}
 LEFT JOIN LATERAL (SELECT * FROM token_value_revisions r WHERE r.token_value_id=e.id
 AND r.version_sequence_number<=0 ORDER BY version_sequence_number DESC LIMIT 1) p ON true
 LEFT JOIN LATERAL (SELECT * FROM token_value_revisions r WHERE r.token_value_id=e.id
 AND r.version_sequence_number<=1 ORDER BY version_sequence_number DESC LIMIT 1) n ON true
 WHERE e.design_system_id=0 AND
 (CASE WHEN p.deleted THEN NULL ELSE p.value END) IS DISTINCT FROM
 (CASE WHEN n.deleted THEN NULL ELSE n.value END) ORDER BY e.id LIMIT 500'''

        report = {'postgres': sql('SELECT version();').strip(), 'fixture': {
            'values': 134400, 'selected_theme': 9600, 'distinct_token_ids_per_owner': 1700,
            'revision_sequences': [0, 1, 2], 'warmup': 3, 'repeats': args.repeats,
            'auto_explain': 'off in both variants',
            'scope': 'SQL shapes only; not HTTP or application query count'}, 'results': {}}
        args.output.mkdir(parents=True, exist_ok=True)

        def measure(label, query):
            text = 'EXPLAIN (ANALYZE,BUFFERS,TIMING OFF,FORMAT JSON) ' + query
            samples = []
            plan = None
            for i in range(args.repeats + 3):
                plan = json.loads(sql(text))[0]
                if i >= 3:
                    samples.append(plan['Execution Time'])
            result = {'median_ms': statistics.median(samples),
                      'p95_ms': sorted(samples)[math.ceil(.95 * len(samples))-1],
                      'samples_ms': samples, 'rows': plan['Plan']['Actual Rows'],
                      'shared_hit_blocks': plan['Plan']['Shared Hit Blocks']}
            report['results'][label] = result
            (args.output / (label + '.json')).write_text(json.dumps(plan, indent=2))
            print(label, result['median_ms'], result['p95_ms'], flush=True)

        def equivalent(left, right):
            mismatch = sql(f'SELECT count(*) FROM ((({left}) EXCEPT ALL ({right})) UNION ALL '
                           f'(({right}) EXCEPT ALL ({left}))) mismatch;')
            if mismatch.strip() != '0':
                raise AssertionError('Результаты вариантов SQL различаются')

        equivalent(old, lateral)
        equivalent(old, batch)
        measure('tenant_lookup_old', 'SELECT * FROM token_values WHERE tenant_id=0')
        measure('values_old', old)
        measure('values_lateral', lateral)
        measure('values_distinct', batch)
        sql('CREATE INDEX value_tenant_token ON token_values(tenant_id,token_id); '
            'CREATE INDEX revision_candidates ON token_value_revisions'
            '(design_system_id,version_sequence_number,token_value_id); ANALYZE;')
        measure('tenant_lookup_indexed', 'SELECT * FROM token_values WHERE tenant_id=0')
        measure('values_lateral_indexed', lateral)
        for count in [0, 3, 9]:
            sql('DELETE FROM token_value_revisions WHERE version_sequence_number=1; '
                f'INSERT INTO token_value_revisions SELECT id,design_system_id,1,false,'
                f'jsonb_build_array(-id) FROM token_values WHERE id<={count}; ANALYZE;')
            equivalent(journal(False), journal(True))
            measure(f'journal_{count}_old', journal(False))
            measure(f'journal_{count}_candidates', journal(True))
        (args.output / 'report.json').write_text(json.dumps(report, indent=2))
    finally:
        docker('stop', name)


if __name__ == '__main__':
    main()
