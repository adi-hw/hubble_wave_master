import { Module } from '@nestjs/common';

/**
 * AvaModule consolidates everything from apps/svc-ava into the apps/api
 * modular monolith. Sub-areas migrate one at a time via git mv; each
 * migration registers its module(s) here.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-ava-migration.md):
 *   Sub-areas:
 *     [ ] ava-tools (AvaToolsModule)
 *     [ ] search (SearchModule)
 *     [ ] modelops (5 modules: Dataset/ModelRegistry/ModelEvaluation/Training/ModelDeployment)
 *     [ ] phase7 (11 standalone controllers + barrel; no module wrapper)
 *   Final top-level (7 controllers + 1 service + app.module thin adapter):
 *     [ ] ava-health.controller (renamed from health.controller)
 *     [ ] chat, embedding, AVA, AVAGovernance, AVASchema, AvaProposal controllers
 *     [ ] AvaPreviewService
 *     [ ] ava.module final composition
 *     [ ] svc-ava app.module thin adapter
 *
 * Note: there is also an AvaModule at apps/api/src/app/automation/ava/ava.module.ts
 * (svc-automation's natural-language automation-rule generator). The two are
 * distinct: this AvaModule is the platform's canonical AVA reasoning layer
 * (canon §11). Both keep the AvaModule class name in their respective
 * namespaces; consumers that need both alias one on import.
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class AvaModule {}
