# Explicit device-language speech

User reports Android Chrome: VI shows only Automatic, while actual speech uses English. Existing launch sets utterance.lang but leaves voice unset when no matching native voice exists, allowing browser default fallback.

Require a real voice returned by getVoices with exact VI/EN language subtag, normalize underscore/case, choose saved matching voice then matching default/first. Check every utterance including resume/auto-next/selection/PDF. Missing voice stops without speaking/completing and gives localized guidance. Never substitute another language or send text to an online service.

Reader panel disables empty selection/play, replaces misleading Automatic/no-voice copy, exposes Android engine/language/voice-data instructions and refresh. Existing voiceschanged/focus/late probes remain. Keep listening checkpoints, rates, pronunciation, footnote exclusion, pauses and VI/EN switching.

TDD hook coverage + browser English-only/empty/late VI/stale choice and EN region; update valid speech fixtures that previously relied on an unlisted default. Unit/typecheck/build and Chromium/mobile/WebKit, then production. Native Android voice installation cannot be done by a website; final instructions must say that clearly. Primary docs: MDN SpeechSynthesisUtterance.voice and Google Android TTS output guide.
