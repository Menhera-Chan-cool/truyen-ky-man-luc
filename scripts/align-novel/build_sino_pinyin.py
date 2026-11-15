"""Han-Viet to pinyin syllable map from Unihan (kVietnamese and kMandarin of the same character).
Usage: python -I build_sino_pinyin.py Unihan_Readings.txt src/data/sino-pinyin.json
Unihan is not kept in the repository; see docs/UNIHAN-NOTICE.md for its source and licence."""
import json,sys,unicodedata,collections
def toneless(p):
    s=unicodedata.normalize('NFD',p.lower().replace('ü','u').replace('ǖ','u').replace('ǘ','u').replace('ǚ','u').replace('ǜ','u'))
    return ''.join(c for c in s if 'a'<=c<='z')
vi=collections.defaultdict(set);py={};
src,out=sys.argv[1],sys.argv[2]
mand={};viet={}
for line in open(src,encoding='utf-8'):
    if line.startswith('#') or not line.strip():continue
    cp,field,value=line.rstrip('\n').split('\t',2)
    if field=='kMandarin':mand[cp]=value.split()
    elif field=='kVietnamese':viet[cp]=value.split()
for cp,readings in viet.items():
    for m in mand.get(cp,[]):
        for r in readings:vi[unicodedata.normalize('NFC',r.lower())].add(toneless(m))
table={k:sorted(v) for k,v in sorted(vi.items())}
json.dump(table,open(out,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print(len(table),'Vietnamese readings,',sum(len(v) for v in table.values()),'pairs')
