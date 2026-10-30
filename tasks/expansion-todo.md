# Reader and editor expansion — complete

See expansion-map.md for the capability map and defaults. All 13 distinct selected capabilities are delivered; publish preflight was listed twice in the request.

- [x] editor-review implemented, validated and deployed.
- [x] batch-replace implemented, validated and deployed.
- [x] collaboration implemented, validated and deployed.
- [x] reader-navigation implemented, validated and deployed.
- [x] parallel-reader implemented, validated and deployed.
- [x] speech-tools implemented, validated and deployed.
- [x] custom-fonts implemented, validated and deployed.
- [x] offline implemented, validated and deployed.
- [x] Migration 004 applied and authenticated integration verified.
- [x] Vitest, typecheck, production build, browser regressions, cloud UI, admin/editor integration.
- [x] Private GitHub source and exact production runtime verified; secret-free source packaging.

## Verification scope

95 unit tests pass. Full local source 54cc5cd: 189 pass / 17 conditional skips / zero failures or flaky cases. Final delta 85f6ee1 is only a 44px, themed comparison select and assertion; rebuilt and all reader-expansion cases pass (5 pass / 1 skip). Exact final Vercel runtime: selected 70 cases, 60 pass / 10 skip / zero failure or flaky cases. Four VI/EN desktop/phone visual combinations pass; comparison and summary controls are 44px. Real Supabase admin/editor verifiers pass and all fixtures are cleaned; published book and real heads unchanged.

See VERIFICATION.md and verification/expansion-*.json for evidence, calibration and physical-device/native-voice limitations. Runtime commit 85f6ee1717defd260063563cdc9c787fe456d012; deployment dpl_6Re7gMgYSrwJmZZEg2AvNMgmMJQA. Subsequent evidence-only Git commits do not require rebuilding unchanged runtime code.
