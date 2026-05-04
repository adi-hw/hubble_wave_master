import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  WorkspaceRecordPageProvider,
  useWorkspaceRecord,
} from './WorkspaceRecordPageProvider';

const RecordSnapshot: React.FC<{ label: string }> = ({ label }) => {
  const ctx = useWorkspaceRecord();
  return (
    <div data-testid={label}>
      {ctx ? `${ctx.workspaceCode}|${ctx.collectionCode}|${ctx.recordId}` : 'NO_RECORD'}
    </div>
  );
};

const SidePanels = () => (
  <>
    <RecordSnapshot label="related" />
    <RecordSnapshot label="activity" />
    <RecordSnapshot label="quick" />
    <RecordSnapshot label="detail" />
  </>
);

describe('WorkspaceRecordPageProvider — Plan §10.4', () => {
  it('reads URL params and shares the same record across four panel children', () => {
    render(
      <MemoryRouter initialEntries={['/workspace/ops/record/work_orders/rec-42']}>
        <Routes>
          <Route
            path="/workspace/:wsCode/record/:collectionCode/:recordId"
            element={
              <WorkspaceRecordPageProvider>
                <SidePanels />
              </WorkspaceRecordPageProvider>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const expected = 'ops|work_orders|rec-42';
    expect(screen.getByTestId('related').textContent).toBe(expected);
    expect(screen.getByTestId('activity').textContent).toBe(expected);
    expect(screen.getByTestId('quick').textContent).toBe(expected);
    expect(screen.getByTestId('detail').textContent).toBe(expected);
  });

  it('returns null context on a non-record route — panels render placeholders, not crash', () => {
    render(
      <MemoryRouter initialEntries={['/workspace/ops']}>
        <Routes>
          <Route
            path="/workspace/:wsCode"
            element={
              <WorkspaceRecordPageProvider>
                <SidePanels />
              </WorkspaceRecordPageProvider>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('related').textContent).toBe('NO_RECORD');
    expect(screen.getByTestId('detail').textContent).toBe('NO_RECORD');
  });

  it('explicit prop bindings win over URL params (Studio preview case)', () => {
    render(
      <MemoryRouter initialEntries={['/workspace/ops/record/work_orders/rec-42']}>
        <Routes>
          <Route
            path="/workspace/:wsCode/record/:collectionCode/:recordId"
            element={
              <WorkspaceRecordPageProvider
                workspaceCode="preview"
                collectionCode="tickets"
                recordId="rec-99"
              >
                <SidePanels />
              </WorkspaceRecordPageProvider>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('detail').textContent).toBe('preview|tickets|rec-99');
  });
});
