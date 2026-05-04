import type React from 'react';
import { RecordListPanel } from './RecordListPanel';
import { RecordDetailPanel } from './RecordDetailPanel';
import { MetricsPanel } from './MetricsPanel';
import { RelatedListPanel } from './RelatedListPanel';
import { QuickActionsPanel } from './QuickActionsPanel';
import { ActivityFeedPanel } from './ActivityFeedPanel';
import { NLQueryPanel } from './NLQueryPanel';
import { IndicatorScorecardPanel } from './IndicatorScorecardPanel';
import { DashboardsOverviewPanel } from './DashboardsOverviewPanel';

export interface PanelComponentProps {
  config: Record<string, unknown>;
}

/**
 * Registry mapping `panelCode` → React component. The runtime
 * renderer and the builder canvas both look up here. Adding a new
 * panel is a two-step change: add an entry to BUILT_IN_PANELS in
 * shared-types, and an entry here pointing at the implementation.
 */
export const PANEL_REGISTRY: Record<string, React.FC<PanelComponentProps>> = {
  RecordListPanel,
  RecordDetailPanel,
  MetricsPanel,
  RelatedListPanel,
  QuickActionsPanel,
  ActivityFeedPanel,
  NLQueryPanel,
  IndicatorScorecardPanel,
  DashboardsOverviewPanel,
};
