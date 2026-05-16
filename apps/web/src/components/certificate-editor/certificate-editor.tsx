'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Plus, Trash2, ZoomIn, ZoomOut, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiUrl } from '@/lib/api';
import type { CertificateFieldConfig, CertificateIssueDateMode } from '@/types/certificate';

const supportedFields = [
  { field: 'name', label: 'Name' },
  { field: 'email', label: 'Email' },
  { field: 'course', label: 'Course' },
  { field: 'role', label: 'Role' },
  { field: 'date', label: 'Date' },
  { field: 'roll_no', label: 'Roll No' },
  { field: 'issue_date', label: 'Issue Date' }
] as const;

const DEFAULT_FREE_TEXT = 'Type your text here';
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 220;
const FONT_SIZE_STEP = 2;

const defaultFieldStyle: CertificateFieldConfig = {
  field: 'name',
  x: 200,
  y: 200,
  width: 320,
  fontSize: 36,
  fontFamily: 'Poppins',
  color: '#111111',
  align: 'center'
};

function clampFontSize(value: number) {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value));
}

function createUniqueFieldName(prefix: string, fields: CertificateFieldConfig[]) {
  let index = fields.length + 1;
  let candidate = `${prefix}_${index}`;
  while (fields.some((field) => field.field === candidate)) {
    index += 1;
    candidate = `${prefix}_${index}`;
  }
  return candidate;
}

function formatIssueDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

export type CertificateTemplateView = {
  id: string;
  name: string;
  backgroundUrl: string;
  imageWidth: number;
  imageHeight: number;
  fieldConfig: CertificateFieldConfig[];
  issueDateMode: CertificateIssueDateMode;
  issueDateValue: string | null;
};

export type CertificateEditorProps = {
  template: CertificateTemplateView;
  onSave: (payload: {
    name: string;
    fieldConfig: CertificateFieldConfig[];
    issueDateMode: CertificateIssueDateMode;
    issueDateValue: string | null;
  }) => Promise<void>;
};

export function CertificateEditor({
  template,
  onSave
}: CertificateEditorProps) {
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toolsPanelRef = useRef<HTMLDivElement | null>(null);
  const toolsToggleRef = useRef<HTMLButtonElement | null>(null);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [name, setName] = useState(template.name);
  const [fields, setFields] = useState<CertificateFieldConfig[]>(template.fieldConfig.length ? template.fieldConfig : []);
  const [selectedField, setSelectedField] = useState<string | null>(template.fieldConfig[0]?.field ?? null);
  const [issueDateMode, setIssueDateMode] = useState<CertificateIssueDateMode>(template.issueDateMode ?? 'current_date');
  const [issueDateValue, setIssueDateValue] = useState<string>(template.issueDateValue ?? new Date().toISOString().slice(0, 10));
  const [customFieldName, setCustomFieldName] = useState('');
  const [customTextValue, setCustomTextValue] = useState(DEFAULT_FREE_TEXT);
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [dragState, setDragState] = useState<{
    field: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    setName(template.name);
    setFields(template.fieldConfig.length ? template.fieldConfig : []);
    setSelectedField(template.fieldConfig[0]?.field ?? null);
    setIssueDateMode(template.issueDateMode ?? 'current_date');
    setIssueDateValue(template.issueDateValue ?? new Date().toISOString().slice(0, 10));
    setSaveState('idle');
    setSaveMessage('');
  }, [template]);

  useEffect(() => {
    if (saveState === 'idle') {
      return;
    }

    const timer = window.setTimeout(() => {
      setSaveState('idle');
      setSaveMessage('');
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [saveState]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const pointerX = (event.clientX - rect.left) / displayZoom;
      const pointerY = (event.clientY - rect.top) / displayZoom;
      const nextX = Math.max(0, pointerX - dragState.offsetX);
      const nextY = Math.max(0, pointerY - dragState.offsetY);
      setFields((current) =>
        current.map((field) =>
          field.field === dragState.field
            ? {
                ...field,
                x: nextX,
                y: nextY
              }
            : field
        )
      );
    };

    const handleUp = () => {
      setDragState(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragState, zoom]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedField || !event.ctrlKey) {
        return;
      }

      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        setFields((current) =>
          current.map((field) =>
            field.field === selectedField ? { ...field, fontSize: clampFontSize(field.fontSize + FONT_SIZE_STEP) } : field
          )
        );
      }

      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        setFields((current) =>
          current.map((field) =>
            field.field === selectedField ? { ...field, fontSize: clampFontSize(field.fontSize - FONT_SIZE_STEP) } : field
          )
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedField]);

  useEffect(() => {
    if (!toolsExpanded) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (toolsPanelRef.current?.contains(target)) {
        return;
      }
      if (toolsToggleRef.current?.contains(target)) {
        return;
      }
      setToolsExpanded(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setToolsExpanded(false);
      }
    };

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [toolsExpanded]);

  const stageWidth = template.imageWidth || 1200;
  const stageHeight = template.imageHeight || 800;

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) {
      return;
    }

    const updateFitZoom = () => {
      const padding = 40;
      const availableWidth = Math.max(0, viewport.clientWidth - padding);
      const availableHeight = Math.max(0, viewport.clientHeight - padding);
      const widthFit = availableWidth > 0 ? availableWidth / stageWidth : 1;
      const heightFit = availableHeight > 0 ? availableHeight / stageHeight : 1;
      setFitZoom(Math.max(0.35, Math.min(1, widthFit, heightFit)));
    };

    updateFitZoom();

    const observer = new ResizeObserver(updateFitZoom);
    observer.observe(viewport);

    window.addEventListener('resize', updateFitZoom);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateFitZoom);
    };
  }, [stageHeight, stageWidth]);

  useEffect(() => {
    const wheelOptions = { passive: false, capture: true } as const;
    const handleWheel = (event: WheelEvent) => {
      if (!selectedField || !editorRootRef.current) {
        return;
      }

      if (!editorRootRef.current.contains(event.target as Node)) {
        return;
      }

      if (!event.ctrlKey) {
        return;
      }

      event.preventDefault();
      changeSelectedFontSize(event.deltaY < 0 ? FONT_SIZE_STEP : -FONT_SIZE_STEP);
    };

    window.addEventListener('wheel', handleWheel, wheelOptions);
    return () => {
      window.removeEventListener('wheel', handleWheel, wheelOptions);
    };
  }, [selectedField]);

  const selected = useMemo(() => fields.find((field) => field.field === selectedField) ?? null, [fields, selectedField]);
  const displayZoom = zoom * fitZoom;
  const resolvedIssueDate = useMemo(() => {
    if (issueDateMode === 'manual' && issueDateValue) {
      return formatIssueDate(issueDateValue);
    }
    return formatIssueDate(new Date().toISOString().slice(0, 10));
  }, [issueDateMode, issueDateValue]);

  const updateField = (fieldName: string, patch: Partial<CertificateFieldConfig>) => {
    setFields((current) => current.map((field) => (field.field === fieldName ? { ...field, ...patch } : field)));
  };

  const addField = (fieldName: string) => {
    const normalizedField = fieldName.trim();
    if (!normalizedField) {
      return;
    }
    setFields((current) => {
      if (current.some((field) => field.field === normalizedField)) {
        setSelectedField(normalizedField);
        return current;
      }

      const nextField: CertificateFieldConfig = {
        ...defaultFieldStyle,
        field: normalizedField,
        x: Math.max(80, stageWidth / 2 - 160),
        y: Math.max(80, stageHeight / 2 - 40),
        width: 320
      };

      setSelectedField(normalizedField);
      return [...current, nextField];
    });
  };

  const addFreeTextField = (text: string) => {
    const trimmedText = text.trim();
    const nextText = trimmedText || DEFAULT_FREE_TEXT;

    setFields((current) => {
      const fieldName = createUniqueFieldName('text', current);
      const nextField: CertificateFieldConfig = {
        ...defaultFieldStyle,
        field: fieldName,
        text: nextText,
        x: Math.max(80, stageWidth / 2 - 160),
        y: Math.max(80, stageHeight / 2 - 40),
        width: Math.max(280, nextText.length * 12)
      };

      setSelectedField(fieldName);
      return [...current, nextField];
    });
  };

  const changeSelectedFontSize = (delta: number) => {
    if (!selectedField) {
      return;
    }

    setFields((current) =>
      current.map((field) =>
        field.field === selectedField ? { ...field, fontSize: clampFontSize(field.fontSize + delta) } : field
      )
    );
  };

  const removeSelected = () => {
    if (!selectedField) {
      return;
    }
    setFields((current) => current.filter((field) => field.field !== selectedField));
    setSelectedField(null);
  };

  return (
    <div
      ref={editorRootRef}
      className="relative grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"
    >
      <button
        ref={toolsToggleRef}
        type="button"
        aria-label={toolsExpanded ? 'Collapse tools' : 'Expand tools'}
        onClick={() => setToolsExpanded((current) => !current)}
        className={`fixed left-3 top-1/2 z-50 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.12)] transition-transform duration-300 hover:bg-slate-50 ${
          toolsExpanded ? 'translate-x-[248px]' : 'translate-x-0'
        }`}
      >
        {toolsExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      <aside
        ref={toolsPanelRef}
        className={`fixed inset-y-4 left-3 z-40 w-[260px] max-w-[calc(100vw-1.5rem)] rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] transition-[transform,opacity] duration-300 ease-out ${
          toolsExpanded
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : '-translate-x-[calc(100%+0.75rem)] opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex h-full min-h-0 flex-col overflow-y-auto">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Placeholders</p>
          <div className="mt-4 space-y-2">
            {supportedFields.map((item) => (
              <button
                key={item.field}
                type="button"
                onClick={() => addField(item.field)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-ink transition hover:border-accent-300 hover:bg-accent-50"
              >
                <span>{item.label}</span>
                <Plus className="h-4 w-4 text-accent-600" />
              </button>
            ))}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Custom field
              </label>
              <div className="flex gap-2">
                <Input
                  value={customFieldName}
                  onChange={(event) => setCustomFieldName(event.target.value)}
                  placeholder="company_name"
                />
                <Button
                  type="button"
                  onClick={() => {
                    addField(customFieldName);
                    setCustomFieldName('');
                  }}
                >
                  Add
                </Button>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Use a custom placeholder like <span className="font-medium text-slate-700">{'{company_name}'}</span>.
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Free text
              </label>
              <textarea
                value={customTextValue}
                onChange={(event) => setCustomTextValue(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-accent-400 focus:ring-4 focus:ring-accent-100"
                placeholder="Type your text here"
              />
              <Button
                type="button"
                className="mt-3 w-full"
                onClick={() => {
                  addFreeTextField(customTextValue);
                  setCustomTextValue(DEFAULT_FREE_TEXT);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add text field
              </Button>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                This text renders directly on the certificate and does not need an Excel column.
              </p>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Zoom</p>
            <div className="mt-3 flex items-center gap-3">
              <ZoomOut className="h-4 w-4 text-slate-500" />
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-full accent-accent-600"
              />
              <ZoomIn className="h-4 w-4 text-slate-500" />
            </div>
            <p className="mt-2 text-xs text-slate-500">Screen fit: {Math.round(displayZoom * 100)}%</p>
          </div>
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            Dynamic placeholders must match your Excel column headers exactly. Free text fields do not need Excel data, and
            both types work best when you keep the spelling and format consistent.
          </p>
        </div>
      </aside>

      <section className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Input value={name} onChange={(event) => setName(event.target.value)} className="sm:max-w-sm" placeholder="Template name" />
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={async () => {
              setSaving(true);
              setSaveState('idle');
              setSaveMessage('');
              try {
                await onSave({
                  name,
                  fieldConfig: fields,
                  issueDateMode,
                  issueDateValue: issueDateMode === 'manual' ? issueDateValue : null
                });
                setSaveState('saved');
                setSaveMessage('Template saved successfully.');
              } catch (error) {
                setSaveState('error');
                setSaveMessage(error instanceof Error ? error.message : 'Failed to save template.');
              } finally {
                setSaving(false);
              }
            }}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save template'}
          </Button>
        </div>

        {saveMessage ? (
          <div
            className={`mb-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${
              saveState === 'saved'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{saveMessage}</span>
          </div>
        ) : null}

        <div
          ref={canvasViewportRef}
          className="w-full overflow-x-auto overflow-y-hidden rounded-[24px] border border-slate-200 bg-slate-100"
          style={{ minHeight: 'calc(100vh - 220px)' }}
        >
          <div
            ref={containerRef}
            className="relative overflow-hidden"
            style={{
              width: stageWidth * displayZoom,
              height: stageHeight * displayZoom
            }}
          >
            {template.backgroundUrl ? (
              <img
                src={`${apiUrl}${template.backgroundUrl}`}
                alt={template.name}
                className="absolute inset-0 h-full w-full select-none object-fill"
                draggable={false}
              />
            ) : null}

            {fields.map((field) => {
              const isSelected = field.field === selectedField;
              const isIssueDate = field.field === 'issue_date';
              const isFreeText = typeof field.text === 'string';
              const displayText = isFreeText ? field.text ?? '' : isIssueDate ? resolvedIssueDate : `{${field.field}}`;
              return (
                <div
                  key={field.field}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedField(field.field)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      setSelectedField(field.field);
                    }
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) {
                      return;
                    }
                    const pointerX = (event.clientX - rect.left) / displayZoom;
                    const pointerY = (event.clientY - rect.top) / displayZoom;
                    setSelectedField(field.field);
                    setDragState({
                      field: field.field,
                      offsetX: pointerX - field.x,
                      offsetY: pointerY - field.y
                    });
                  }}
                  className={`absolute cursor-move select-none rounded-md px-1 py-0.5 transition ${
                    isSelected ? 'ring-2 ring-accent-500 ring-offset-2 ring-offset-transparent' : 'hover:ring-1 hover:ring-accent-200'
                  }`}
                  style={{
                    left: field.x * displayZoom,
                    top: field.y * displayZoom,
                    width: field.width * displayZoom,
                    fontSize: field.fontSize * displayZoom,
                    color: field.color,
                    fontFamily: field.fontFamily,
                    textAlign: field.align,
                    lineHeight: 1.1
                  }}
                >
                  {isSelected ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeSelected();
                      }}
                      className="absolute -right-3 -top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 shadow-md transition hover:bg-red-50"
                      aria-label={`Remove ${field.field}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                  <span
                    className={`pointer-events-none block bg-white/0 ${
                      isFreeText ? 'whitespace-pre-wrap break-words' : 'whitespace-nowrap'
                    }`}
                  >
                    {displayText}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Selected</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              {selected ? (selected.text !== undefined ? 'Free text' : `{${selected.field}}`) : 'None'}
            </p>
          </div>
          {selected ? (
            <button
              type="button"
              onClick={removeSelected}
              className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          ) : null}
        </div>

        {selected ? (
          <div className="mt-5 space-y-4">
            {selected.text !== undefined ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Text content</label>
                <textarea
                  value={selected.text}
                  onChange={(event) => updateField(selected.field, { text: event.target.value })}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-accent-400 focus:ring-4 focus:ring-accent-100"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Hold <span className="font-semibold text-slate-700">Ctrl</span> and scroll to resize the selected text.
                  You can also use <span className="font-semibold text-slate-700">Ctrl +</span> and{' '}
                  <span className="font-semibold text-slate-700">Ctrl -</span>.
                </p>
              </div>
            ) : null}
            {selected.field === 'issue_date' ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">Issue date</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIssueDateMode('current_date')}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      issueDateMode === 'current_date' ? 'bg-ink text-white' : 'bg-white text-slate-600'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueDateMode('manual')}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      issueDateMode === 'manual' ? 'bg-ink text-white' : 'bg-white text-slate-600'
                    }`}
                  >
                    Manual
                  </button>
                </div>
                {issueDateMode === 'manual' ? (
                  <div className="mt-3">
                    <label className="mb-2 block text-sm font-medium text-slate-700">Date</label>
                    <Input type="date" value={issueDateValue} onChange={(event) => setIssueDateValue(event.target.value)} />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Will use today&apos;s date when certificates are generated.</p>
                )}
              </div>
            ) : null}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">X</label>
              <Input
                type="number"
                value={selected.x}
                onChange={(event) => updateField(selected.field, { x: Number(event.target.value) })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Y</label>
              <Input
                type="number"
                value={selected.y}
                onChange={(event) => updateField(selected.field, { y: Number(event.target.value) })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Width</label>
              <Input
                type="number"
                value={selected.width}
                onChange={(event) => updateField(selected.field, { width: Number(event.target.value) })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Font size</label>
              <Input
                type="number"
                value={selected.fontSize}
                onChange={(event) => updateField(selected.field, { fontSize: clampFontSize(Number(event.target.value)) })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Font family</label>
              <select
                value={selected.fontFamily}
                onChange={(event) => updateField(selected.field, { fontFamily: event.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="Poppins">Poppins</option>
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Color</label>
              <Input
                type="color"
                value={selected.color}
                onChange={(event) => updateField(selected.field, { color: event.target.value })}
                className="h-12 p-1"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Align</label>
              <select
                value={selected.align}
                onChange={(event) => updateField(selected.field, { align: event.target.value as CertificateFieldConfig['align'] })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        ) : (
          <p className="mt-5 text-sm leading-6 text-slate-500">Click a placeholder to place it on the certificate, then drag it where you want it.</p>
        )}
      </aside>
    </div>
  );
}
