import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  ExternalLink,
  Eye,
  Loader2,
  Pencil,
  PenSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useStudioCollection } from '../CollectionContext';
import { useAuth } from '../../../../auth/AuthContext';
import { Button } from '../../../../components/ui/Button';
import { ConfirmModal } from '../../../../components/ui/Modal';
import { DataGrid, type ColumnDef } from '../../../../components/data/DataGrid';
import {
  deleteData,
  listDataWithMeta,
  updateData,
  type ListDataResponse,
  type ModelProperty,
} from '../../../../services/platform.service';
import { schemaService } from '../../../../services/schema';
import {
  DESTRUCTIVE_ICON_BUTTON,
  NEUTRAL_ICON_BUTTON,
} from '../../../../lib/styling';

const SPREADSHEET_WRITE_PERMISSION = 'metadata.collections.spreadsheet.write';

interface RecordRow {
  id: string;
  [key: string]: unknown;
}

const SYSTEM_RECORD_FIELDS = new Set([
  'id',
  'deleted_at',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
]);

const editableInputClass =
  'min-w-[11rem] rounded border border-border bg-card px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none';

const editableCheckboxClass = 'h-4 w-4 accent-primary';

const hasOwn = (obj: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

const getPropertyKind = (property: ModelProperty): string =>
  [property.type, property.backendType, property.uiWidget]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const isBooleanProperty = (property: ModelProperty): boolean =>
  getPropertyKind(property).includes('boolean') ||
  getPropertyKind(property).includes('checkbox');

const isNumberProperty = (property: ModelProperty): boolean => {
  const kind = getPropertyKind(property);
  return (
    kind.includes('integer') ||
    kind.includes('decimal') ||
    kind.includes('number') ||
    kind.includes('currency') ||
    kind.includes('percent') ||
    kind.includes('percentage') ||
    kind.includes('duration')
  );
};

const isJsonProperty = (property: ModelProperty, value?: unknown): boolean => {
  const kind = getPropertyKind(property);
  return (
    kind.includes('json') ||
    kind.includes('array') ||
    kind.includes('object') ||
    kind.includes('multi') ||
    Array.isArray(value) ||
    (typeof value === 'object' && value !== null)
  );
};

const isLongTextProperty = (property: ModelProperty): boolean =>
  getPropertyKind(property).includes('long') ||
  getPropertyKind(property).includes('textarea') ||
  getPropertyKind(property).includes('text_area');

const getDateInputValue = (value: unknown, includeTime: boolean): string => {
  if (value === null || value === undefined || value === '') return '';
  const raw = String(value);
  if (!includeTime && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (includeTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    return raw.slice(0, 16);
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return includeTime ? date.toISOString().slice(0, 16) : date.toISOString().slice(0, 10);
};

const getInputValue = (value: unknown, property: ModelProperty): unknown => {
  const kind = getPropertyKind(property);
  if (isBooleanProperty(property)) return Boolean(value);
  if (kind.includes('datetime') || kind.includes('date time')) {
    return getDateInputValue(value, true);
  }
  if (kind.includes('date')) {
    return getDateInputValue(value, false);
  }
  if (isJsonProperty(property, value)) {
    if (value === null || value === undefined || value === '') return '';
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  return value === null || value === undefined ? '' : String(value);
};

const isInlineEditableProperty = (property: ModelProperty): boolean => {
  const code = property.code.toLowerCase();
  const config = property.config ?? {};
  if (SYSTEM_RECORD_FIELDS.has(code)) return false;
  if (config.readonly === true || config.readOnly === true || config.isReadonly === true) {
    return false;
  }
  return true;
};

const coerceValueForSave = (value: unknown, property: ModelProperty): unknown => {
  if (isBooleanProperty(property)) return Boolean(value);

  if (value === '') {
    return property.nullable ? null : '';
  }

  if (isNumberProperty(property)) {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      throw new Error(`${property.label} must be a number.`);
    }
    return numeric;
  }

  if (isJsonProperty(property)) {
    if (value === null || value === undefined || value === '') return property.nullable ? null : '';
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`${property.label} must be valid JSON.`);
    }
  }

  return value;
};

const formatCellValue = (value: unknown, property: ModelProperty): React.ReactNode => {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">-</span>;
  }
  if (property.type === 'checkbox' || property.backendType === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (property.type === 'date' || property.type === 'datetime') {
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return String(value);
    return property.type === 'date' ? d.toLocaleDateString() : d.toLocaleString();
  }
  if (typeof value === 'object') {
    return <span className="font-mono text-xs">{JSON.stringify(value)}</span>;
  }
  return String(value);
};

const buildColumns = (
  properties: ModelProperty[],
  editMode: boolean,
  drafts: Record<string, Record<string, unknown>>,
  onDraftValueChange: (row: RecordRow, property: ModelProperty, value: unknown) => void,
): ColumnDef<RecordRow>[] =>
  properties
    .filter((p) => p.code !== 'id' && p.code !== 'deleted_at')
    .map((p) => ({
      id: p.code,
      header: p.label,
      accessor: p.code as keyof RecordRow,
      sortable: true,
      formatter: (value, row) => {
        if (!editMode || !isInlineEditableProperty(p)) {
          return formatCellValue(value, p);
        }

        const draft = drafts[row.id] ?? {};
        const draftValue = hasOwn(draft, p.code) ? draft[p.code] : getInputValue(value, p);
        const ariaLabel = `${p.label} for record ${row.id}`;
        const stopPropagation = (event: React.SyntheticEvent) => event.stopPropagation();
        const kind = getPropertyKind(p);

        if (isBooleanProperty(p)) {
          return (
            <input
              type="checkbox"
              checked={Boolean(draftValue)}
              aria-label={ariaLabel}
              className={editableCheckboxClass}
              onClick={stopPropagation}
              onChange={(event) => onDraftValueChange(row, p, event.target.checked)}
            />
          );
        }

        if (isJsonProperty(p, value) || isLongTextProperty(p)) {
          return (
            <textarea
              value={String(draftValue ?? '')}
              aria-label={ariaLabel}
              className={`${editableInputClass} min-h-16 resize-y`}
              onClick={stopPropagation}
              onKeyDown={stopPropagation}
              onChange={(event) => onDraftValueChange(row, p, event.target.value)}
            />
          );
        }

        const inputType = kind.includes('datetime') || kind.includes('date time')
          ? 'datetime-local'
          : kind.includes('date')
          ? 'date'
          : kind.includes('time')
          ? 'time'
          : isNumberProperty(p)
          ? 'number'
          : 'text';

        return (
          <input
            type={inputType}
            value={String(draftValue ?? '')}
            aria-label={ariaLabel}
            className={editableInputClass}
            onClick={stopPropagation}
            onKeyDown={stopPropagation}
            onChange={(event) => onDraftValueChange(row, p, event.target.value)}
          />
        );
      },
    }));

const getErrorMessage = (err: unknown, fallback: string): string => {
  const responseData = (err as { response?: { data?: { message?: unknown; error?: unknown } } })
    ?.response?.data;
  const responseMessage = responseData?.message ?? responseData?.error;
  if (Array.isArray(responseMessage)) {
    return responseMessage.join('; ');
  }
  if (typeof responseMessage === 'string' && responseMessage.trim()) {
    return responseMessage;
  }
  return err instanceof Error ? err.message : fallback;
};

/**
 * RecordRows sub-tab of the Data tab. Per ADR-16, the spreadsheet renders
 * read-only by default; flipping into edit mode requires the
 * `metadata.collections.spreadsheet.write` permission AND emits an
 * audit-log row capturing the entry event itself (not just the
 * downstream record mutations). The audit hook lives at
 * POST /collections/:id/spreadsheet/audit-edit-mode-entry.
 *
 * In edit mode the grid edits records inline and saves per row (or all
 * dirty rows from the toolbar). The explicit edit gate still emits the
 * ADR-16 audit event before any editable cells appear.
 */
export const SpreadsheetView: React.FC = () => {
  const collection = useStudioCollection();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(SPREADSHEET_WRITE_PERMISSION);

  const [records, setRecordRows] = useState<RecordRow[]>([]);
  const [recordTotal, setRecordTotal] = useState(0);
  const [properties, setProperties] = useState<ModelProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [enteringEditMode, setEnteringEditMode] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<RecordRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result: ListDataResponse = await listDataWithMeta(collection.code, {
        pageSize: 100,
      });
      setRecordRows((result.data ?? []) as RecordRow[]);
      setProperties(result.properties ?? []);
      setRecordTotal(result.meta?.total ?? result.data?.length ?? 0);
      setDrafts({});
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load records'));
    } finally {
      setLoading(false);
    }
  }, [collection.code]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!editMode) setDrafts({});
  }, [editMode]);

  const dirtyRowIds = useMemo(
    () => Object.keys(drafts).filter((id) => Object.keys(drafts[id] ?? {}).length > 0),
    [drafts],
  );

  const handleDraftValueChange = useCallback(
    (row: RecordRow, property: ModelProperty, value: unknown) => {
      const rowId = String(row.id);
      const originalValue = getInputValue(row[property.code], property);
      const nextComparable = isBooleanProperty(property) ? Boolean(value) : String(value ?? '');
      const originalComparable = isBooleanProperty(property)
        ? Boolean(originalValue)
        : String(originalValue ?? '');

      setDrafts((current) => {
        const nextRowDraft = { ...(current[rowId] ?? {}) };
        if (nextComparable === originalComparable) {
          delete nextRowDraft[property.code];
        } else {
          nextRowDraft[property.code] = value;
        }

        const next = { ...current };
        if (Object.keys(nextRowDraft).length === 0) {
          delete next[rowId];
        } else {
          next[rowId] = nextRowDraft;
        }
        return next;
      });
    },
    [],
  );

  const columns = useMemo(
    () => buildColumns(properties, editMode, drafts, handleDraftValueChange),
    [drafts, editMode, handleDraftValueChange, properties],
  );

  const enterEditMode = useCallback(async () => {
    if (enteringEditMode || editMode) return;
    setEnteringEditMode(true);
    setError(null);
    try {
      await schemaService.recordSpreadsheetEditModeEntry(collection.id);
      setEditMode(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to enter edit mode'));
    } finally {
      setEnteringEditMode(false);
    }
  }, [collection.id, editMode, enteringEditMode]);

  const handleRowClick = useCallback(
    (row: RecordRow) => {
      navigate(`/${collection.code}/${row.id}`);
    },
    [collection.code, navigate],
  );

  const buildPayload = useCallback(
    (draft: Record<string, unknown>) => {
      const payload: Record<string, unknown> = {};
      for (const [code, value] of Object.entries(draft)) {
        const property = properties.find((p) => p.code === code);
        if (!property) continue;
        payload[code] = coerceValueForSave(value, property);
      }
      return payload;
    },
    [properties],
  );

  const setRowSaving = useCallback((rowId: string, saving: boolean) => {
    setSavingRows((current) => {
      const next = new Set(current);
      if (saving) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  }, []);

  const saveRow = useCallback(
    async (row: RecordRow) => {
      const rowId = String(row.id);
      const draft = drafts[rowId];
      if (!draft || Object.keys(draft).length === 0 || savingRows.has(rowId)) return;

      setRowSaving(rowId, true);
      setError(null);
      try {
        const updated = await updateData(collection.code, rowId, buildPayload(draft));
        setRecordRows((current) =>
          current.map((record) =>
            String(record.id) === rowId ? { ...record, ...(updated as RecordRow) } : record,
          ),
        );
        setDrafts((current) => {
          const next = { ...current };
          delete next[rowId];
          return next;
        });
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to save record'));
      } finally {
        setRowSaving(rowId, false);
      }
    },
    [buildPayload, collection.code, drafts, savingRows, setRowSaving],
  );

  const saveAllDrafts = useCallback(async () => {
    const rowsById = new Map(records.map((row) => [String(row.id), row]));
    for (const rowId of dirtyRowIds) {
      const row = rowsById.get(rowId);
      if (row) {
        await saveRow(row);
      }
    }
  }, [dirtyRowIds, records, saveRow]);

  const discardRowChanges = useCallback((rowId: string) => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  }, []);

  const renderRowActions = useCallback(
    (row: RecordRow): React.ReactNode => {
      const rowId = String(row.id);
      const rowDirty = !!drafts[rowId] && Object.keys(drafts[rowId]).length > 0;
      const rowSaving = savingRows.has(rowId);

      return (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void saveRow(row);
            }}
            disabled={!rowDirty || rowSaving}
            title="Save row"
            className={`${NEUTRAL_ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {rowSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              discardRowChanges(rowId);
            }}
            disabled={!rowDirty || rowSaving}
            title="Discard row changes"
            className={`${NEUTRAL_ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/${collection.code}/${row.id}`);
            }}
            title="Open record details"
            className={NEUTRAL_ICON_BUTTON}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(row);
            }}
            title="Delete record"
            className={DESTRUCTIVE_ICON_BUTTON}
          >
            <Trash2 size={14} />
          </button>
        </div>
      );
    },
    [collection.code, discardRowChanges, drafts, navigate, saveRow, savingRows],
  );

  const onConfirmDelete = useCallback(async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteData(collection.code, confirmDelete.id);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete record'));
    } finally {
      setDeleting(false);
    }
  }, [collection.code, confirmDelete, load]);

  const openSchemaView = useCallback(() => {
    const nextParams = new URLSearchParams(params);
    nextParams.delete('view');
    setParams(nextParams, { replace: true });
  }, [params, setParams]);

  const storageDeploymentError =
    error?.includes('has not been deployed') || error?.includes('Deploy the schema');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
              editMode
                ? 'border-warning-text/30 bg-warning-subtle text-warning-text'
                : 'border-border bg-muted text-muted-foreground',
            ].join(' ')}
          >
            {editMode ? <PenSquare size={12} /> : <Eye size={12} />}
            {editMode ? 'Edit mode' : 'Read-only'}
          </span>
          <span className="text-xs text-muted-foreground">
            {recordTotal} {recordTotal === 1 ? 'record' : 'records'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {editMode && dirtyRowIds.length > 0 ? (
            <>
              <span className="text-xs text-muted-foreground">
                {dirtyRowIds.length} edited {dirtyRowIds.length === 1 ? 'row' : 'rows'}
              </span>
              <Button variant="outline" size="sm" onClick={() => setDrafts({})}>
                <RotateCcw size={14} />
                Discard edits
              </Button>
              <Button size="sm" onClick={() => void saveAllDrafts()}>
                <Save size={14} />
                Save edits
              </Button>
            </>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          {editMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/${collection.code}/new`)}
              >
                <Plus size={14} />
                New record
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
                Exit edit mode
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => void enterEditMode()}
              disabled={!canEdit || enteringEditMode}
              title={
                canEdit
                  ? 'Audit-logged. Enables record-level edit and delete actions.'
                  : `Requires the ${SPREADSHEET_WRITE_PERMISSION} permission`
              }
            >
              {enteringEditMode ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <PenSquare size={14} />
              )}
              Enter edit mode
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/${collection.code}.list`)}
            title="Open the full list view"
          >
            <ExternalLink size={14} />
            Open list view
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col gap-3 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <AlertCircle size={14} />
            <span className="min-w-0">{error}</span>
          </div>
          {storageDeploymentError ? (
            <button
              type="button"
              onClick={openSchemaView}
              className="rounded border border-destructive/30 bg-card px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              Open schema
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        <DataGrid<RecordRow>
          data={records}
          columns={columns}
          loading={loading}
          rowKey="id"
          onRowClick={editMode ? undefined : handleRowClick}
          rowActions={editMode ? renderRowActions : undefined}
          emptyMessage="No records yet."
          stickyHeader
          searchable
        />
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete this record?"
        message="This will soft-delete the record. It can be restored from the audit log if needed."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => void onConfirmDelete()}
      />
    </div>
  );
};
