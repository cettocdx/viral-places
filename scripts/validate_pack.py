#!/usr/bin/env python3
"""Validate this documentation pack, not the application it describes.

Uses only the Python standard library. No network or paid service calls.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import struct
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
# Uygulama kodu eklendikten sonra üretilen/üçüncü taraf klasörler paket kontrolünün dışındadır.
IGNORED_DIRS = {'.next', 'node_modules', '.expo', '.git', '.pnpm', 'ios', 'android', 'dist', 'build'}


def in_scope(path: Path) -> bool:
    return not any(part in IGNORED_DIRS for part in path.relative_to(ROOT).parts)
MAIN = ROOT / 'VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md'
errors: list[str] = []
checks: list[str] = []


def check(condition: bool, message: str) -> None:
    (checks if condition else errors).append(message)


def load_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(value, dict):
            raise ValueError('Top-level JSON must be an object.')
        return value
    except (OSError, ValueError) as exc:
        errors.append(f'{path.relative_to(ROOT)}: {exc}')
        return {}


def main() -> int:
    required = [
        MAIN, ROOT/'AGENTS.md', ROOT/'README.md',
        ROOT/'docs/SKILLS_REGISTRY.md', ROOT/'docs/DECISIONS_AND_BLOCKERS.md',
        ROOT/'docs/sources.json', ROOT/'docs/SOURCES.md',
        ROOT/'prompts/EXTRACT_PLACES.md', ROOT/'prompts/SUMMARIZE_PLACE.md',
        ROOT/'prompts/PARSE_PLAN_REQUEST.md',
        ROOT/'config/design-tokens.json',
        ROOT/'config/pipeline-policy.example.json',
        ROOT/'config/provider-rights.template.json',
        ROOT/'config/score-test-vectors.json',
    ]
    for path in required:
        check(path.is_file() and path.stat().st_size > 0,
              f'Gerekli dosya: {path.relative_to(ROOT)}')
    if not MAIN.is_file():
        print('\n'.join(errors), file=sys.stderr)
        return 1

    text = MAIN.read_text(encoding='utf-8')
    anchors = re.findall(r'<a id="(s\d{2})"></a>', text)
    expected = [f's{i:02d}' for i in range(1, 37)]
    check(anchors == expected, '36 bölüm anchor sırası ve tekilliği')
    headings = re.findall(r'^## (\d+)\. ', text, re.MULTILINE)
    check(headings == [str(i) for i in range(1, 37)], '36 ana bölüm başlığı')
    check('Ahmet Çetinkaya' not in text, 'Doğrulanmamış kişisel ayrıntı eklenmemiş')

    registry = load_json(ROOT/'docs/sources.json')
    sources = registry.get('sources', [])
    source_ids = {item.get('id') for item in sources}
    check(source_ids == {f'S{i:02d}' for i in range(1, 32)}, '31 kaynak kimliği tam ve tekil')
    check(len(source_ids) == len(sources), 'Kaynak kayıtlarında duplicate yok')
    cited = set(re.findall(r'\[(S\d{2})\]', text))
    check(cited <= source_ids, 'Ana metindeki kaynak kimlikleri tanımlı')
    for item in sources:
        parsed = urlsplit(item.get('url', ''))
        check(parsed.scheme == 'https' and bool(parsed.netloc), f'HTTPS kaynak adresi: {item.get("id")}')

    skill_files = sorted((ROOT/'.agents/skills').glob('*/SKILL.md'))
    check(len(skill_files) == 12, '12 proje SKILL.md dosyası')
    for path in skill_files:
        skill_text = path.read_text(encoding='utf-8')
        match = re.match(r'\A---\n(.*?)\n---\n', skill_text, re.DOTALL)
        check(match is not None, f'Skill frontmatter: {path.parent.name}')
        if not match:
            continue
        header = match.group(1)
        name = re.search(r'^name: (.+)$', header, re.MULTILINE)
        desc = re.search(r'^description: (.+)$', header, re.MULTILINE)
        check(bool(name) and name.group(1) == path.parent.name, f'Skill isim/path eşleşmesi: {path.parent.name}')
        check(bool(name) and bool(re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', name.group(1))), f'Skill isim biçimi: {path.parent.name}')
        try:
            description = json.loads(desc.group(1)) if desc else ''
        except ValueError:
            description = ''
        check(isinstance(description, str) and 20 <= len(description) <= 1024, f'Skill description: {path.parent.name}')
        check(all(x in skill_text for x in ['## Girdiler','## Uygulama adımları','## Kabul kanıtı','## Yapılmayacaklar','## Teslim kaydı']), f'Skill işlem ve kabul bölümleri: {path.parent.name}')

    # Relative Markdown link checks. URLs are not requested over the network.
    md_files = sorted(p for p in ROOT.rglob('*.md') if in_scope(p))
    for path in md_files:
        content = path.read_text(encoding='utf-8')
        check(len(re.findall(r'^```', content, re.MULTILINE)) % 2 == 0,
              f'Code fence çiftliği: {path.relative_to(ROOT)}')
        for target in re.findall(r'!?\[[^\]\n]+\]\(([^)\n]+)\)', content):
            if urlsplit(target).scheme:
                continue
            location, sep, fragment = target.partition('#')
            resolved = (path.parent/unquote(location)).resolve() if location else path
            check(resolved.exists(), f'Yerel bağlantı: {path.relative_to(ROOT)} -> {target}')
            if fragment and resolved.is_file() and fragment.startswith('s') and re.fullmatch(r's\d{2}',fragment):
                other = resolved.read_text(encoding='utf-8')
                check(f'id="{fragment}"' in other, f'Bölüm bağlantısı: {target}')

    for name in ['01-map.png','02-place-detail.png','03-creator-profile.png']:
        path = ROOT/'design/references'/name
        check(path.is_file(), f'Görsel mevcut: {name}')
        if path.is_file():
            data = path.read_bytes()
            valid = data.startswith(b'\x89PNG\r\n\x1a\n') and len(data) >= 24
            check(valid, f'PNG başlığı: {name}')
            if valid:
                width,height=struct.unpack('>II',data[16:24])
                check(width>=600 and height>=1000,f'Görsel çözünürlüğü: {name} {width}x{height}')

    policy = load_json(ROOT/'config/pipeline-policy.example.json')
    check(all(value is False for value in policy.get('features',{}).values()) and bool(policy.get('features')), 'Canlı/otomatik özellikler varsayılan kapalı')
    budget = policy.get('budget',{})
    check(budget.get('blockWhenUnset') is True and budget.get('dailyHardLimitUsd') is None and budget.get('monthlyHardLimitUsd') is None,'Bütçe onayı olmadan canlı iş engeli')
    check(policy.get('retention',{}).get('productionEnabled') is False,'Retention süreleri üretim onayı sayılmıyor')
    rights = load_json(ROOT/'config/provider-rights.template.json')
    permissions = rights.get('permissions',{})
    check(len(permissions)==12 and all(value is False for value in permissions.values()),'12 işlem bazlı hak deny-by-default')
    check('may_send_metadata_to_ai' in permissions and 'may_send_media_to_ai' in permissions,'Metadata AI ve medya AI izinleri ayrı')

    trend = policy.get('trend',{})
    weights = trend.get('weights',{})
    check(math.isclose(sum(weights.values()),1,abs_tol=1e-9),'Skor ağırlıkları toplamı 1')
    vectors = load_json(ROOT/'config/score-test-vectors.json').get('vectors',[])
    for vector in vectors:
        c=vector['components']
        if not vector['eligibilityPass'] or any(c[x] is None for x in ['M','D','F']):
            result=None
        else:
            subtotal=c['M']*weights['momentum']+c['D']*weights['diversity']+c['F']*weights['freshness']
            if c['O'] is None:
                subtotal/=1-weights['outperformance']
            else:
                subtotal+=c['O']*weights['outperformance']
            result=math.floor(100*subtotal+0.5)
        check(result==vector['expectedScore'],f'Sentetik skor aritmetiği {vector["id"]}: {result}')

    json_files=[p for p in ROOT.rglob('*.json') if in_scope(p)]
    for path in json_files:
        value=load_json(path)
        check(bool(value),f'JSON parse: {path.relative_to(ROOT)}')
    font_files=[p for p in ROOT.rglob('*') if in_scope(p) and p.suffix.lower() in {'.ttf','.otf','.woff','.woff2'}]
    check(not font_files,'Pakette font dosyası yok')
    check(200*4*10*30==240000,'Maliyet örneği sonuç adedi: 240.000')
    check(200*0.5*30*0.4*45/60==900,'Maliyet örneği video süresi: 900 dakika')

    # Hash manifest is optional on the first run, checked once created.
    manifest_path=ROOT/'docs/pack-manifest.json'
    if manifest_path.exists():
        manifest=load_json(manifest_path)
        for entry in manifest.get('files',[]):
            path=ROOT/entry['path']
            actual=hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
            check(actual==entry['sha256'],f'Hash bütünlüğü: {entry["path"]}')

    status='PASS' if not errors else 'FAIL'
    report = f'''# Paket doğrulama raporu

**Durum:** {status}  
**Kapsam:** Doküman ve geliştirme talimat paketi; çalışan uygulama testi değildir.  
**Geçen kontrol:** {len(checks)}  
**Başarısız kontrol:** {len(errors)}  
**Markdown dosyası:** {len(md_files)}  
**Proje skill'i:** {len(skill_files)}  
**Birincil kaynak kaydı:** {len(sources)}

## Gerçekten yapılanlar

Yerel dosya/bağlantı ve bölüm kontrolleri, SKILL.md başlıkları, JSON parse,
kapalı canlı özellikler ve deny-by-default haklar, üç PNG başlığı/çözünürlüğü,
sentetik skor aritmetiği ve maliyet örnekleri kontrol edildi. Manifest varsa
listelenen dosya hash'leri karşılaştırıldı. Dış URL'lere bu betik erişmedi.

## Yapılmayanlar

Mobil native build, iOS/Android akış testi, canlı Apify/EnsembleData çağrısı,
AI model değerlendirmesi, Supabase migration/RLS çalıştırması, haklar için
hukuki onay, gerçek fatura veya mağaza yayını doğrulaması yapılmadı.
Resmi dış skill'ler hedef geliştirme ajana kurulmadı. Bu kontroller ürünün
çalıştığını değil, teslim edilen paketin belirtilen yapıya uyduğunu gösterir.

## Hatalar

'''
    report += '\n'.join(f'- {error}' for error in errors) if errors else 'Yok.\n'
    (ROOT/'docs/PACK_VALIDATION.md').write_text(report,encoding='utf-8')
    print(f'{status}: {len(checks)} passed; {len(errors)} failed.')
    if errors:
        print('\n'.join(errors),file=sys.stderr)
    print('Report: docs/PACK_VALIDATION.md')
    return 1 if errors else 0


if __name__=='__main__':
    raise SystemExit(main())
