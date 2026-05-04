import React, { useRef, useState } from 'react';
import { Variable } from 'lucide-react';
import { DataPillPicker, type DataPillCategory } from './DataPillPicker';

export interface DataPillButtonProps {
  categories: DataPillCategory[];
  /**
   * Triggered with the selected pill token (e.g. "{trigger.priority}").
   * The caller decides where to insert it — most callers append to a
   * controlled input value.
   */
  onSelect: (token: string) => void;
  className?: string;
  title?: string;
  disabled?: boolean;
}

/**
 * Plan §8.1.4 — single-button DataPillPicker entry point.
 *
 * Drop next to any text input that authors might want to bind to a
 * runtime value. The button opens the shared `DataPillPicker`
 * popover and forwards the chosen token to the caller. By
 * standardising on this wrapper, every builder (Form Builder
 * default-value editor, Flow Action panels, Automation Rule
 * conditions, Display Rule conditions) gets the same UX without
 * each duplicating the popover state.
 */
export const DataPillButton: React.FC<DataPillButtonProps> = ({
  categories,
  onSelect,
  className,
  title = 'Insert variable',
  disabled,
}) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={title}
        disabled={disabled}
        className={
          className ??
          'inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40'
        }
      >
        <Variable size={12} />
      </button>
      <DataPillPicker
        open={open}
        categories={categories}
        anchorEl={buttonRef.current}
        onClose={() => setOpen(false)}
        onSelect={(pill) => {
          onSelect(pill.token);
          setOpen(false);
        }}
      />
    </>
  );
};
