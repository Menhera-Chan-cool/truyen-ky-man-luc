// Usage: npx tsx scripts/align-novel/chapter2-regressions.ts ARTIFACT_DIR
// Checks the sentence/clause regressions reported in chapter 2 in both directions, plus neighbour-overreach and partial-selection controls.
import fs from 'node:fs/promises';
import path from 'node:path';
import {lookupArtifact,validateAlignmentArtifact} from '../../src/lib/novel-lookup';
const dir=process.argv[2];if(!dir)throw Error('Usage: chapter2-regressions.ts ARTIFACT_DIR');
const a=validateAlignmentArtifact(JSON.parse(await fs.readFile(path.join(dir,'chapter-2.json'),'utf8')));
const text={vi:a.editions.vi.text,en:a.editions.en.text};
const cases=[
 {name:'two English sentences ↔ one multi-clause Vietnamese sentence',en:'Phung had a son named Trong Quy, and Tu had a daughter named Nhi Khanh. She was beautiful and he was talented, and they were close in age.',vi:'Phùng có người con trai là Trọng Quỳ, Từ có người con gái là Nhị Khanh, gái sắc trai tài, tuổi cũng suýt soát.',neighbour:'Hai người'},
 {name:'meeting, admiration and marriage hope',en:'The two often met at banquets. He admired her beauty and she prized his gifts, and they began to hope that their families might be joined in marriage, as the Zhu and Chen clans(3) of old had been.',vi:'Hai người thường gặp nhau trong những bữa tiệc, mến vì tài, yêu vì sắc, cũng có ý muốn kết duyên Châu Trần.',neighbour:'Cha mẹ'},
 {name:'contrast with omitted subject',en:'He did not heed her, but he held her in great esteem all the same',vi:'Chàng tuy không nghe nhưng cũng rất kính trọng.',neighbour:'Năm chàng'},
 {name:'complete mapped sentence that must keep its whole meaning',en:"Though Nhi Khanh was still young, once she entered the Phung household she conducted herself with great tact toward her husband's kin.",vi:'Nhị Khanh tuy hãy còn nhỏ, nhưng sau khi về nhà họ Phùng, khéo biết cư xử với họ hàng,',neighbour:'hòa thuận'},
];
const norm=(s:string)=>s.replace(/\s+/g,' ').replace(/\(\d+\)/g,'').replace(/[.,;:\s]+$/u,'').trim();
let failed=0;
for(const c of cases)for(const locale of ['en','vi'] as const){
 const other=locale==='en'?'vi':'en',quote=c[locale],start=text[locale].indexOf(quote);
 if(start<0){console.log('MISSING',c.name,locale);failed++;continue;}
 const r=lookupArtifact(a,{chapterId:a.chapterId,locale,revision:a.editions[locale].revision,start,end:start+quote.length,text:quote});
 const got=norm(r.passages.flatMap(p=>p.highlights.map(h=>text[other].slice(h.start,h.end))).join(' ')),want=norm(c[other]);
 const ok=got===want&&!norm(r.passages.map(p=>p.target.text).join(' ')).includes(c.neighbour)&&!r.unmatchedSource?.length&&r.status!=='context-only';
 console.log(ok?'ok  ':'FAIL',locale+'→'+other,c.name,'|',r.status);if(!ok){failed++;console.log('   got',got,'\n   want',want);}
}
process.exit(failed?1:0);
