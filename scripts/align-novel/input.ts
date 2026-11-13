import {createHash} from 'node:crypto';
import {extractAlignmentText,alignmentCodec} from '../../src/lib/novel-text';
import type {Locale} from '../../src/lib/types';

export const algorithm='labse-book-mbert-2';
type PublishedEdition={versionId:string;revision:number;html:string};
function edition(value:PublishedEdition,locale:Locale){
 if(!value||!/^[-0-9a-f]{36}$/i.test(value.versionId)||!Number.isSafeInteger(value.revision)||value.revision<1||typeof value.html!=='string'||Buffer.byteLength(value.html)>2097152)throw Error('Invalid published alignment input');
 const text=extractAlignmentText(value.html,locale);
 return {...text,versionId:value.versionId,revision:value.revision,hash:createHash('sha256').update(text.text).digest('hex')};
}
export function makeAlignmentInput(chapterId:string,editions:Record<Locale,PublishedEdition>){
 if(!/^[a-z0-9-]{1,80}$/.test(chapterId))throw Error('Invalid chapter');
 return {chapterId,editions:{vi:edition(editions.vi,'vi'),en:edition(editions.en,'en')}};
}
export function matchesAlignmentInput(artifact:{codec:string;chapterId:string;editions:Record<Locale,{versionId:string;revision:number;hash:string;text:string}>},input:ReturnType<typeof makeAlignmentInput>){
 return artifact.codec===alignmentCodec&&artifact.chapterId===input.chapterId&&(['vi','en'] as const).every(l=>{
  const a=artifact.editions[l],e=input.editions[l];return a.versionId===e.versionId&&a.revision===e.revision&&a.hash===e.hash&&a.text===e.text;
 });
}
