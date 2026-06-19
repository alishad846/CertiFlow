'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Plus, Trash2, ZoomIn, ZoomOut, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, apiUrl } from '@/lib/api';
import { getTemplatePreviewSrc } from '@/lib/template-preview';
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
  width: 180,
  fontSize: 36,
  fontFamily: 'Poppins',
  color: '#111111',
  align: 'center'
};

type EditorFieldConfig = CertificateFieldConfig & {
  id: string;
};

type PreviewPage = {
  pageNumber: number;
  width: number;
  height: number;
  src: string;
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

function createEditorFieldId(fieldName: string, index: number) {
  const safeFieldName = fieldName.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'field';
  return `${safeFieldName}-${index + 1}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEditorFields(fields: CertificateFieldConfig[]) {
  return fields.map((field, index) => {
    const existingId = (field as CertificateFieldConfig & { id?: string }).id?.trim();
    return {
      ...field,
      pageNumber: field.pageNumber ?? 1,
      id: existingId || createEditorFieldId(field.field, index)
    };
  });
}

function stripEditorFieldIds(fields: EditorFieldConfig[]) {
  return fields.map(({ id, ...field }) => field);
}

function getPlaceholderFieldWidth(fieldName: string) {
  const displayName = fieldName.replace(/_/g, ' ');
  return Math.max(140, Math.min(260, 96 + displayName.length * 12));
}

function getFreeTextFieldWidth(text: string) {
  const longestLine = text.split('\n').reduce((max, line) => Math.max(max, line.length), 0);
  return Math.max(140, Math.min(360, 48 + longestLine * 10));
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
  const [name, setName] = useState(template.name);
  const [fields, setFields] = useState<EditorFieldConfig[]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [issueDateMode, setIssueDateMode] = useState<CertificateIssueDateMode>(template.issueDateMode ?? 'current_date');
  const [issueDateValue, setIssueDateValue] = useState<string>(template.issueDateValue ?? new Date().toISOString().slice(0, 10));
  const [customFieldName, setCustomFieldName] = useState('');
  const [customTextValue, setCustomTextValue] = useState(DEFAULT_FREE_TEXT);
  const [previewPages, setPreviewPages] = useState<PreviewPage[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [dragState, setDragState] = useState<{
    field: string;
    pageNumber: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    setName(template.name);
    const nextFields = template.fieldConfig.length ? normalizeEditorFields(template.fieldConfig) : [];
    setFields(nextFields);
    setSelectedField(nextFields[0]?.id ?? null);
    setActivePage(1);
    setIssueDateMode(template.issueDateMode ?? 'current_date');
    setIssueDateValue(template.issueDateValue ?? new Date().toISOString().slice(0, 10));
    setSaveState('idle');
    setSaveMessage('');
  }, [template]);

  useEffect(() => {
    let active = true;
    pageRefs.current = [];

    if (!template.backgroundUrl.toLowerCase().endsWith('.pdf')) {
      setPreviewPages([]);
      setPreviewLoading(false);
      setActivePage(1);
      return () => {
        active = false;
      };
    }

    setPreviewLoading(true);
    apiFetch<{ pages: Array<{ pageNumber: number; width: number; height: number; src: string }> }>(
      `/certificate-templates/${template.id}/preview-pages`
    )
      .then((data) => {
        if (!active) {
          return;
        }

        setPreviewPages(
          data.pages.map((page) => ({
            ...page,
            src: `${apiUrl}${page.src}`
          }))
        );
      })
      .catch(() => {
        if (active) {
          setPreviewPages([]);
        }
      })
      .finally(() => {
        if (active) {
          setPreviewLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [template.backgroundUrl, template.id]);

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
      const container = pageRefs.current[dragState.pageNumber];
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
          field.id === dragState.field
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
            field.id === selectedField ? { ...field, fontSize: clampFontSize(field.fontSize + FONT_SIZE_STEP) } : field
          )
        );
      }

      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        setFields((current) =>
          current.map((field) =>
            field.id === selectedField ? { ...field, fontSize: clampFontSize(field.fontSize - FONT_SIZE_STEP) } : field
          )
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedField]);

  const selected = useMemo(() => fields.find((field) => field.id === selectedField) ?? null, [fields, selectedField]);
  const displayZoom = zoom * fitZoom;
  const previewSrc = getTemplatePreviewSrc(template);
  const isPdfTemplate = template.backgroundUrl.toLowerCase().endsWith('.pdf');
  const pagesToRender: PreviewPage[] = isPdfTemplate
    ? previewPages.length
      ? previewPages
      : [
          {
            pageNumber: 1,
            width: template.imageWidth ?? 1200,
            height: template.imageHeight ?? 800,
            src: previewSrc
          }
        ]
    : [
        {
          pageNumber: 1,
          width: template.imageWidth ?? 1200,
          height: template.imageHeight ?? 800,
          src: previewSrc
        }
      ];
  const activePreviewPage = pagesToRender.find((page) => page.pageNumber === activePage) ?? pagesToRender[0];
  const stageWidth = activePreviewPage?.width ?? template.imageWidth ?? 1200;
  const stageHeight = activePreviewPage?.height ?? template.imageHeight ?? 800;

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

  const resolvedIssueDate = useMemo(() => {
    if (issueDateMode === 'manual' && issueDateValue) {
      return formatIssueDate(issueDateValue);
    }
    return formatIssueDate(new Date().toISOString().slice(0, 10));
  }, [issueDateMode, issueDateValue]);

  const updateField = (fieldId: string, patch: Partial<CertificateFieldConfig>) => {
    setFields((current) => current.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)));
  };

  const addField = (fieldName: string) => {
    const normalizedField = fieldName.trim();
    if (!normalizedField) {
      return;
    }
    const id = createEditorFieldId(normalizedField, fields.length);
    const nextField: EditorFieldConfig = {
      ...defaultFieldStyle,
      id,
      field: normalizedField,
      pageNumber: activePage,
      x: Math.max(80, stageWidth / 2 - 160),
      y: Math.max(80, stageHeight / 2 - 40),
      width: getPlaceholderFieldWidth(normalizedField)
    };

    setSelectedField(id);
    setFields((current) => [...current, nextField]);
  };

  const addFreeTextField = (text: string) => {
    const trimmedText = text.trim();
    const nextText = trimmedText || DEFAULT_FREE_TEXT;
    const id = createEditorFieldId('text', fields.length);

    const fieldName = createUniqueFieldName('text', fields);
    const nextField: EditorFieldConfig = {
      ...defaultFieldStyle,
      id,
      field: fieldName,
      pageNumber: activePage,
      text: nextText,
      x: Math.max(80, stageWidth / 2 - 160),
      y: Math.max(80, stageHeight / 2 - 40),
      width: getFreeTextFieldWidth(nextText)
    };

    setSelectedField(id);
    setFields((current) => [...current, nextField]);
  };

  const changeSelectedFontSize = (delta: number) => {
    if (!selectedField) {
      return;
    }

    setFields((current) =>
      current.map((field) =>
        field.id === selectedField ? { ...field, fontSize: clampFontSize(field.fontSize + delta) } : field
      )
    );
  };

  const removeSelected = () => {
    if (!selectedField) {
      return;
    }
    setFields((current) => current.filter((field) => field.id !== selectedField));
    setSelectedField(null);
  };

  return (
    <div
      ref={editorRootRef}
      className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start"
    >
      <section className="order-2 min-w-0 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)] xl:sticky xl:top-6 xl:order-1 xl:self-start">
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
                  fieldConfig: stripEditorFieldIds(fields),
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
          className="w-full overflow-auto rounded-[24px] border border-slate-200 bg-slate-100"
          style={{ minHeight: 'calc(100vh - 220px)', maxHeight: 'calc(100vh - 220px)' }}
        >
          <div className="space-y-4 p-4">
            {previewLoading ? (
              <div className="rounded-[18px] border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                Loading PDF pages...
              </div>
            ) : null}
            {pagesToRender.map((page) => {
              const pageFields = fields.filter((field) => (field.pageNumber ?? 1) === page.pageNumber);
              const isActivePage = activePage === page.pageNumber;
              return (
              <div
                key={page.pageNumber}
                ref={(element) => {
                  pageRefs.current[page.pageNumber] = element;
                }}
                onPointerDown={() => setActivePage(page.pageNumber)}
                className={`relative overflow-hidden rounded-[18px] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)] ${
                  isActivePage ? 'border-2 border-accent-500' : 'border border-slate-300'
                }`}
                style={{
                  width: page.width * displayZoom,
                  height: page.height * displayZoom
                }}
              >
                <img
                  src={page.src}
                  alt={`${template.name} page ${page.pageNumber}`}
                  className="absolute inset-0 h-full w-full select-none object-fill"
                  draggable={false}
                />

                <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                  Page {page.pageNumber}
                </div>

                {pageFields.map((field) => {
                  const isSelected = field.id === selectedField;
                  const isIssueDate = field.field === 'issue_date';
                  const isFreeText = typeof field.text === 'string';
                  const displayText = isFreeText ? field.text ?? '' : isIssueDate ? resolvedIssueDate : `{${field.field}}`;
                  return (
                    <div
                      key={`${page.pageNumber}-${field.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedField(field.id);
                        setActivePage(field.pageNumber ?? 1);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          setSelectedField(field.id);
                          setActivePage(field.pageNumber ?? 1);
                        }
                      }}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        const rect = pageRefs.current[page.pageNumber]?.getBoundingClientRect();
                        if (!rect) {
                          return;
                        }
                        const pointerX = (event.clientX - rect.left) / displayZoom;
                        const pointerY = (event.clientY - rect.top) / displayZoom;
                        setSelectedField(field.id);
                        setDragState({
                          field: field.id,
                          pageNumber: page.pageNumber,
                          offsetX: pointerX - field.x,
                          offsetY: pointerY - field.y
                        });
                      }}
                      className={`absolute cursor-move select-none rounded-md px-1 py-0.5 transition ${
                        isSelected
                          ? 'ring-2 ring-accent-500 ring-offset-2 ring-offset-transparent'
                          : 'hover:ring-1 hover:ring-accent-200'
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
            );
            })}
          </div>
        </div>
      </section>

      <aside className="order-1 min-w-0 space-y-6 xl:order-2">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Editing tools</p>
              <p className="mt-1 text-xs font-medium text-slate-400">Drag, add, edit</p>
            </div>
          </div>

          {pagesToRender.length > 1 ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Placement page</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {pagesToRender.map((page) => (
                  <button
                    key={page.pageNumber}
                    type="button"
                    onClick={() => setActivePage(page.pageNumber)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      activePage === page.pageNumber ? 'bg-ink text-white' : 'bg-white text-slate-600'
                    }`}
                  >
                    Page {page.pageNumber}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

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
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
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
            {pagesToRender.length > 1 ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Page</label>
                <select
                  value={selected.pageNumber ?? 1}
                  onChange={(event) => {
                    const nextPageNumber = Number(event.target.value);
                    updateField(selected.id, { pageNumber: nextPageNumber });
                    setActivePage(nextPageNumber);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                >
                  {pagesToRender.map((page) => (
                    <option key={page.pageNumber} value={page.pageNumber}>
                      Page {page.pageNumber}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {selected.text !== undefined ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Text content</label>
                <textarea
                  value={selected.text}
                  onChange={(event) => updateField(selected.id, { text: event.target.value })}
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
                onChange={(event) => updateField(selected.id, { x: Number(event.target.value) })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Y</label>
              <Input
                type="number"
                value={selected.y}
                onChange={(event) => updateField(selected.id, { y: Number(event.target.value) })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Width</label>
              <Input
                type="number"
                value={selected.width}
                onChange={(event) => updateField(selected.id, { width: Number(event.target.value) })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Font size</label>
              <Input
                type="number"
                value={selected.fontSize}
                onChange={(event) => updateField(selected.id, { fontSize: clampFontSize(Number(event.target.value)) })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Font family</label>
              <select
                value={selected.fontFamily}
                onChange={(event) => updateField(selected.id, { fontFamily: event.target.value })}
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
                onChange={(event) => updateField(selected.id, { color: event.target.value })}
                className="h-12 p-1"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Align</label>
              <select
                value={selected.align}
                onChange={(event) => updateField(selected.id, { align: event.target.value as CertificateFieldConfig['align'] })}
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
        </section>
      </aside>
    </div>
  );
}
