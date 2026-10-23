# Approved implementation
1. Define and test bilingual content/import/anchor boundaries. Import the actual EPUB and twenty DOCX translations without modifying sources.
2. Build book detail and complete responsive reader with IndexedDB progress/annotations, themes, speech, scrolling, sound, image and PDF handling.
3. Build editor/import preview, direct Storage uploads, history, optimistic concurrency and publication. Add Supabase schema/RLS and invitation-only auth; lock admin until configured.
4. Unit/integration and browser checks, source-repo example smoke tests, desktop/mobile inspection, production build, Vercel deployment and live checks.

Commands: npm run test; npm run typecheck; npm run build; npm run test:e2e. Sources live in src/, schemas in supabase/, tests in tests/ and e2e/. Do not store secrets or original private upload files in public/. Never claim Supabase integration passed without a real database run.
