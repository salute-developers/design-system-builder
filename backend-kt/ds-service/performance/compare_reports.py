#!/usr/bin/env python3
"""Проверяет эквивалентность HTTP-ответов и пороги приёмки двух последовательных серий."""
import argparse
import json
import hashlib
from pathlib import Path


READ_TARGETS = {'tenant', 'token-values', 'palette', 'size-tokens',
                'journal-empty', 'summary-empty', 'journal-3', 'summary-3', 'journal-9', 'summary-9'}


def response_digests(report_path, names):
    result = {}
    for name in names:
        sample = report_path.with_name(report_path.stem + '-' + name + '.json')
        value = json.loads(sample.read_text())
        if isinstance(value, list) and all(isinstance(row, dict) and 'id' in row for row in value):
            value.sort(key=lambda row: row['id'])
        if name == 'palette':
            value['tokens'].sort(key=lambda row: row['tokenId'])

        def canonical(item):
            if isinstance(item, dict):
                return {k: canonical(v) for k, v in sorted(item.items()) if k != 'changedAt'}
            if isinstance(item, list):
                return [canonical(v) for v in item]
            return item

        text = json.dumps(canonical(value), ensure_ascii=False, separators=(',', ':'))
        result[name] = hashlib.sha256(text.encode()).hexdigest()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--current', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    baseline = json.loads(args.baseline.read_text())
    current = json.loads(args.current.read_text())
    failures = []
    if baseline['values'] != current['values'] or current['values'] < 120000:
        failures.append('Размеры исходного и нового наборов не совпадают или недостаточны')
    if min(baseline['repeats'], current['repeats']) < 20:
        failures.append('Недостаточно измерений')
    if set(current['responseDigests']) != READ_TARGETS | {'tokens'}:
        failures.append('Отсутствуют обязательные отпечатки ответов')
    old_digests = response_digests(args.baseline, READ_TARGETS | {'tokens'})
    new_digests = response_digests(args.current, READ_TARGETS | {'tokens'})
    if old_digests != new_digests:
        failures.append('Нормализованные HTTP-ответы различаются')
    rows = []
    for name in sorted(READ_TARGETS | {'tokens', 'revert-command'}):
        old = baseline['measurements'][name]
        new = current['measurements'][name]
        gain = 100 * (1 - new['medianMs'] / old['medianMs'])
        if name in READ_TARGETS and gain < 30:
            failures.append(f'{name}: улучшение медианы меньше 30 процентов')
        # Каталог определений измеряется отдельно: основной порог относится к данным темы и журналу.
        if new['p95Ms'] > old['p95Ms'] * 1.1:
            failures.append(f'{name}: p95 ухудшился больше чем на 10 процентов')
        if name == 'revert-command' and new['medianMs'] > old['medianMs'] * 1.1:
            failures.append('Команда отмены: медиана ухудшилась больше чем на 10 процентов')
        rows.append({'scenario': name, 'baseline': old, 'current': new, 'median_improvement_percent': gain})
        print(f'{name}: {old["medianMs"]:.2f} -> {new["medianMs"]:.2f} ms ({gain:.1f}%)')
    result = {'fixture_values': current['values'], 'repeats': current['repeats'],
              'response_digests_match': old_digests == new_digests,
              'comparison_source': 'captured full HTTP responses, independently normalized',
              'scenarios': rows, 'failures': failures}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit('\n'.join(failures))


if __name__ == '__main__':
    main()
