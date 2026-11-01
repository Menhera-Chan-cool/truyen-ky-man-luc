import type {Locale} from "./types";
export const voiceMatchesLocale=(voice:Pick<SpeechSynthesisVoice,"lang">,locale:Locale)=>voice.lang.replace(/_/g,"-").split("-")[0].toLowerCase()===locale;
export function speechVoice(voices:SpeechSynthesisVoice[],locale:Locale,saved:string){
 const available=voices.filter(voice=>voiceMatchesLocale(voice,locale));
 return available.find(voice=>voice.name===saved||voice.voiceURI===saved)??available.find(voice=>voice.default)??available[0];
}
