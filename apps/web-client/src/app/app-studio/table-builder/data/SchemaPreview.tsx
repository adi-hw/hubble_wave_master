import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Database,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import {
  schemaService,
  type SchemaOperation,
  type SchemaPlan,
} from '../../../../services/schema';

interface SchemaPreviewProps {
  open: boolean;
  collectionCode: string;
  collectionLabel: string;
  onClose: () => void;
  onDeployed?: () => void;
}

interface GroupedOperations {
  createTables: Extract<SchemaOperation, { type: 'create_table' }>[];
  addColumns: Extract<SchemaOperation, { type: 'add_column' }>[];
  addIndexes: Extract<SchemaOperation, { type: 'add_index' }>[];
}

const groupOperations = (operations: SchemaOperation[]): GroupedOperations => {
  const out: GroupedOperations = { createTables: [], addColumns: [], addIndexes: [] };
  for (const op of operations) {
    if (op.type === 'create_table') {
      out.createTables.push(op);
    } else if (op.type === 'add_column') {
      out.addColumns.push(op);
    } else if (op.type === 'add_index') {
      out.addIndexes.push(op);
    }
  }
  return out;
};

const sectionHeading = 'mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground';
const ddlBlock =
  'whitespace-pre-wrap break-all rounded border border-border bg-muted/40 p-3 font-mono text-xs text-foreground';

/**
 * Renders the planned DDL diff for the active Collection's current
 * draft against Postgres. Deploy still runs against published metadata,
 * so this modal intentionally treats draft preview as read-only.
 */
export const SchemaPreview: React.FC<SchemaPreviewProps> = ({
  open,
  collectionCode,
  collectionLabel,
  onClose,
  onDeployed,
}) => {
  const [plan, setPlan] = useState<SchemaPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await schemaService.getSchemaPlan([collectionCode], {
        source: 'draft',
      });
      setPlan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schema plan');
    } finally {
      setLoading(false);
    }
  };

  const deploy = async () => {
    setDeploying(true);
    setError(null);
    try {
      await schemaService.deploySchemaPlan([collectionCode]);
      onDeployed?.();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy schema');
    } finally {
      setDeploying(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, collectionCode]);

  const grouped = useMemo(
    () => (plan ? groupOperations(plan.operations) : { createTables: [], addColumns: [], addIndexes: [] }),
    [plan],
  );
  const totalOps = plan?.operations.length ?? 0;
  const issues = plan?.issues ?? [];
  const blockingIssues = issues.filter((issue) => issue.severity === 'blocking');
  const isDraftPreview = true;
  const canDeploy =
    !isDraftPreview &&
    !!plan &&
    totalOps > 0 &&
    blockingIssues.length === 0 &&
    !loading &&
    !deploying;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Schema preview | ${collectionLabel}`}
      description={`Review the DDL for the current draft of "${collectionCode}".`}
      size="full"
      scrollable
      footer={
        <>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={14} className="mr-1.5 animate-spin" />
                Refreshing
              </>
            ) : (
              <>
                <RefreshCw size={14} className="mr-1.5" />
                Refresh
              </>
            )}
          </Button>
          <Button
            onClick={() => void deploy()}
            disabled={!canDeploy}
            loading={deploying}
            title={
              isDraftPreview
                ? 'Publish the draft before deploying physical schema changes'
                : blockingIssues.length > 0
                ? 'Resolve blocking schema issues before deploying'
                : totalOps === 0
                ? 'No schema changes to deploy'
                : 'Apply the pending schema operations'
            }
            leftIcon={<Upload size={14} />}
          >
            Deploy schema
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      {loading && !plan ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          Computing schema plan...
        </div>
      ) : error ? (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <AlertCircle size={14} />
            Schema plan failed
          </div>
          <p>{error}</p>
        </div>
      ) : !plan ? null : totalOps === 0 ? (
        <div className="space-y-4">
          <SchemaIssues issues={issues} />
          <div className="rounded border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">
              No pending deployed-schema changes
            </p>
            <p>
              The deployed table for this Collection matches its current draft metadata.
              Save property edits before refreshing this preview.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <SchemaIssues issues={issues} />
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{totalOps}</span>{' '}
              {totalOps === 1 ? 'operation' : 'operations'} | schema{' '}
            <span className="font-mono">{plan.schema}</span> | generated{' '}
            {new Date(plan.generatedAt).toLocaleString()}
          </div>

          {grouped.createTables.length > 0 && (
            <section>
              <h3 className={sectionHeading}>
                <Database size={12} />
                Create tables ({grouped.createTables.length})
              </h3>
              <div className="space-y-2">
                {grouped.createTables.map((op) => (
                  <div key={`create-${op.table}`}>
                    <div className="mb-1 text-xs text-muted-foreground">
                      <span className="font-mono">
                        {op.schema}.{op.table}
                      </span>
                    </div>
                    <pre className={ddlBlock}>{op.ddl}</pre>
                  </div>
                ))}
              </div>
            </section>
          )}

          {grouped.addColumns.length > 0 && (
            <section>
              <h3 className={sectionHeading}>
                <Plus size={12} />
                Add columns ({grouped.addColumns.length})
              </h3>
              <div className="overflow-hidden rounded border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left">Table</th>
                      <th className="px-3 py-2 text-left">Column</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="w-20 px-3 py-2 text-center">Nullable</th>
                      <th className="px-3 py-2 text-left">Default</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.addColumns.map((op) => (
                      <tr
                        key={`col-${op.table}-${op.column.name}`}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {op.table}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-foreground">
                          {op.column.name}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-foreground">
                          {op.column.type}
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {op.column.nullable ? 'yes' : 'no'}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {op.column.defaultValue ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {grouped.addIndexes.length > 0 && (
            <section>
              <h3 className={sectionHeading}>
                <KeyRound size={12} />
                Add indexes ({grouped.addIndexes.length})
              </h3>
              <div className="overflow-hidden rounded border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left">Index</th>
                      <th className="px-3 py-2 text-left">Table</th>
                      <th className="px-3 py-2 text-left">Columns</th>
                      <th className="w-20 px-3 py-2 text-center">Unique</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.addIndexes.map((op) => (
                      <tr
                        key={`idx-${op.indexName}`}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-3 py-2 font-mono text-xs text-foreground">
                          {op.indexName}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {op.table}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-foreground">
                          {op.columns.join(', ')}
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {op.unique ? 'yes' : 'no'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
};

const SchemaIssues: React.FC<{ issues: NonNullable<SchemaPlan['issues']> }> = ({ issues }) => {
  if (issues.length === 0) return null;
  return (
    <div className="rounded border border-warning-border bg-warning-subtle p-3 text-sm text-warning-text">
      <div className="mb-2 flex items-center gap-2 font-medium">
        <AlertTriangle size={14} />
        Schema deploy needs attention
      </div>
      <ul className="list-disc space-y-1 pl-5">
        {issues.map((issue, index) => (
          <li key={`${issue.collectionCode}-${issue.propertyCode ?? index}`}>
            <span className="font-medium">{issue.severity}</span>
            {': '}
            {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
};
