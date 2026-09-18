"""Pinned REMAN XML adapter. Python standard library avoids new npm dependencies."""
import collections
import hashlib
import json
import os
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

SOURCES = {
    'reman': ('https://www.ims.uni-stuttgart.de/documents/ressourcen/korpora/reman/reman.zip', '8f459b868ee77accb59b8b96566e1a263dd748492dd5af8b17feb512b928f8f8'),
    'nrc': ('https://saifmohammad.com/WebDocs/Lexicons/NRC-Emotion-Lexicon.zip', '4edcbd00b1d38ace19ecebca17a50ce08719785b9476cd12d31532eff0fc34e6'),
}


def load_archive(name):
    url, expected = SOURCES[name]
    path = Path(f'data/raw/affect/{name}.zip')
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        with urllib.request.urlopen(url, timeout=60) as response:
            content = response.read()
        if hashlib.sha256(content).hexdigest() != expected:
            raise ValueError(f'Source hash mismatch: {name}')
        path.write_bytes(content)
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise ValueError(f'Source hash mismatch: {name}')
    return zipfile.ZipFile(path)


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    os.replace(tmp, path)


def parse_document(node):
    text = node.findtext('text')
    if text is None:
        raise ValueError('Missing document text')
    spans = [dict(s.attrib, text=s.text or '') for s in node.findall('./adjudicated/spans/span')]
    relations = [dict(r.attrib) for r in node.findall('./adjudicated/relations/relation')]
    ids = {s['annotation_id'] for s in spans}
    issues = []
    if len(ids) != len(spans):
        issues.append({'reason': 'duplicate-span-id'})
    for s in spans:
        start, end = int(s['cbegin']), int(s['cend'])
        if not 0 <= start < end <= len(text) or text[start:end] != s['text']:
            issues.append({'reason': 'span-offset-mismatch', 'spanId': s['annotation_id']})
        # Store both source code-point offsets and JavaScript UTF-16 offsets.
        s['start'] = len(text[:start].encode('utf-16-le')) // 2
        s['end'] = len(text[:end].encode('utf-16-le')) // 2
    for r in relations:
        if r['source_annotation_id'] not in ids or r['target_annotation_id'] not in ids:
            issues.append({'reason': 'dangling-relation', 'relationId': r['relation_id']})
    author = node.attrib['author']
    # Author grouping also keeps alternate Gutenberg editions by an author together.
    split = 'test' if int(hashlib.sha256(('affect-v1:' + author).encode()).hexdigest()[:8], 16) % 5 == 0 else 'dev'
    return dict(node.attrib, text=text, spans=spans, relations=relations, split=split,
                rejectedAnnotationCount=len(node.findall('./other/spans/span'))), issues


def main():
    reman = load_archive('reman')
    xml = reman.read('reman/reman-version1.0.xml')
    root = ET.fromstring(xml)
    documents, quarantine = [], []
    id_counts = collections.Counter(node.attrib['doc_id'] for node in root)
    for node in root:
        document, issues = parse_document(node)
        if id_counts[document['doc_id']] > 1:
            issues.append({'reason': 'duplicate-document-id'})
        if issues:
            quarantine.append({'id': document['doc_id'], 'issues': issues})
        else:
            documents.append(document)
    assert len(root) == 1720
    # Guard against exact duplicate excerpts crossing the frozen author split.
    text_splits = {}
    for document in documents:
        key = hashlib.sha256(document['text'].encode()).hexdigest()
        if key in text_splits and text_splits[key] != document['split']:
            raise ValueError('Duplicate excerpt crosses split')
        text_splits[key] = document['split']
    nrc = load_archive('nrc')
    lexicon = {}
    for line in nrc.read('NRC-Emotion-Lexicon/NRC-Emotion-Lexicon-Wordlevel-v0.92.txt').decode('utf-8-sig').splitlines():
        fields = line.split('\t')
        if len(fields) != 3 or fields[2] not in ('0', '1'):
            continue  # Release includes a prose header.
        word, emotion, value = fields
        if value == '1':
            lexicon.setdefault(word, []).append(emotion)
    assert len(lexicon) > 5000
    audit = {'version': 1, 'sourceDocuments': len(root), 'retainedDocuments': len(documents),
             'quarantinedDocuments': len(quarantine), 'quarantineIssues': dict(collections.Counter(i['reason'] for q in quarantine for i in q['issues'])),
             'splits': dict(collections.Counter(d['split'] for d in documents)),
             'splitPolicy': 'sha256(affect-v1:author) first 8 hex modulo 5; zero=test',
             'quarantine': quarantine}
    payload = {'version': 1, 'sources': {k: {'url': v[0], 'sha256': v[1]} for k, v in SOURCES.items()}, 'documents': documents, 'lexicon': lexicon}
    write_json('data/processed/affect.json', payload)
    write_json('data/processed/affect-audit.json', audit)
    print(json.dumps({k: v for k, v in audit.items() if k != 'quarantine'}, indent=2))


if __name__ == '__main__':
    main()
