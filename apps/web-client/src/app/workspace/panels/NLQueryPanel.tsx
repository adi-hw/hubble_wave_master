import React from 'react';
import { PanelShell } from './PanelShell';
import { AvaChat } from '../../../features/ava/AvaChat';
import { useWorkspaceRecord } from '../WorkspaceRecordPageProvider';

interface Props {
  config: Record<string, unknown>;
}

/**
 * Plan §10.2 — Natural-language query surface backed by svc-ava.
 * Mounts the existing `AvaChat` embedded surface inside the
 * workspace canvas. The optional topic code becomes the AvaContext
 * `page` so workspace-scoped chat sessions thread separately. When
 * the panel sits on a record page, the bound recordId / collection
 * also flow through so AVA can answer "this record" questions.
 */
export const NLQueryPanel: React.FC<Props> = ({ config }) => {
  const topicCode = config.topicCode as string | undefined;
  const record = useWorkspaceRecord();
  return (
    <PanelShell title="Ask AVA" subtitle={topicCode ?? 'platform'}>
      <div className="h-full">
        <AvaChat
          showHeader={false}
          placeholder="Ask AVA…"
          context={{
            page: topicCode ?? 'workspace',
            recordId: record?.recordId,
          }}
          className="h-full"
        />
      </div>
    </PanelShell>
  );
};
