'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Save,
  X,
  FileSpreadsheet,
  Wand2,
  Move
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, apiUrl } from '@/lib/api';
import { getTemplatePreviewSrc } from '@/lib/template-preview';
import type { CertificateFieldConfig, CertificateIssueDateMode } from '@/types/certificate';

/*
const supportedFields = [
  { field: 'name', label: 'Name' },
  { field: 'email', label: 'Email' },
  { field: 'course', label: 'Course' },
  { field: 'role', label: 'Role' },
  { field: 'date', label: 'Date' },
  { field: 'roll_no', label: 'Roll No' },
  { field: 'issue_date', label: 'Issue Date' }
] as const;
*/

const DEFAULT_FREE_TEXT = 'Type your text here';
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 220;
const FONT_SIZE_STEP = 2;
const SNAP_DISTANCE = 8;

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
  height?: number;
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
  const [history, setHistory] = useState<EditorFieldConfig[][]>([]);

const [availableFields, setAvailableFields] = useState<
  {
    field: string;
    label: string;
  }[]
>([]);

const [excelFile, setExcelFile] =
  useState<File | null>(null);

const [detectingFields, setDetectingFields] =
  useState(false);

const [showGuides, setShowGuides] =
  useState(true);
  const [guideLines, setGuideLines] = useState<{
  vertical: number | null;
  horizontal: number | null;
}>({
  vertical: null,
  horizontal: null
});

const [snapEnabled, setSnapEnabled] =
  useState(true);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const copiedField = useRef<EditorFieldConfig | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
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
 
const [resizeState, setResizeState] = useState<{
  field: string;
  handle: string;
  startX: number;
  startY: number;
  startWidth: number;
  startLeft: number;
  startTop: number;
  startHeight: number;
  startFontSize: number;
} | null>(null);

const [rotateState, setRotateState] = useState<{
  field: string;
  startAngle: number;
} | null>(null);
 
  useEffect(() => {

  if (!resizeState) return;

  const handleMove = (event: PointerEvent) => {

    const dx = event.clientX - resizeState.startX;
    const dy = event.clientY - resizeState.startY;

    setFields((current) =>
      current.map((field) =>
        field.id === resizeState.field
          ? {
    ...field,

    x:
      ["left", "top-left", "bottom-left"].includes(resizeState.handle)
        ? resizeState.startLeft + dx / (zoom * fitZoom)
        : field.x,

    y:
      ["top", "top-left", "top-right"].includes(resizeState.handle)
        ? resizeState.startTop + dy / (zoom * fitZoom)
        : field.y,

    width:
      ["left", "top-left", "bottom-left"].includes(resizeState.handle)
        ? Math.max(
            40,
            resizeState.startWidth - dx / (zoom * fitZoom)
          )
        : ["right", "top-right", "bottom-right"].includes(resizeState.handle)
        ? Math.max(
            40,
            resizeState.startWidth + dx / (zoom * fitZoom)
          )
        : field.width,

    height:
      ["top", "top-left", "top-right"].includes(resizeState.handle)
        ? Math.max(
            40,
            resizeState.startHeight - dy / (zoom * fitZoom)
          )
        : ["bottom", "bottom-left", "bottom-right"].includes(resizeState.handle)
        ? Math.max(
            40,
            resizeState.startHeight + dy / (zoom * fitZoom)
          )
        : field.height ?? 50,

    fontSize:
      ["top-left", "top-right", "bottom-left", "bottom-right"].includes(
        resizeState.handle
      )
        ? Math.max(
            8,
            Math.min(
              220,
              resizeState.startFontSize +
                (resizeState.handle.includes("left")
                  ? -dx
                  : dx) /
                  (zoom * fitZoom * 5)
            )
          )
        : field.fontSize
  }
: field

      )
    );

  };

  const handleUp = () => {
    setResizeState(null);
  };

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp);

  return () => {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
  };

}, [resizeState, zoom, fitZoom]);

useEffect(() => {

  if (!dragState) return;

  const handleMove = (event: PointerEvent) => {

    const container = pageRefs.current[dragState.pageNumber];
    if (!container) return;

    const rect = container.getBoundingClientRect();

    const pointerX =
  (event.clientX - rect.left) / (zoom * fitZoom);

const pointerY =
  (event.clientY - rect.top) / (zoom * fitZoom);

let nextX = pointerX - dragState.offsetX;
let nextY = pointerY - dragState.offsetY;

if (event.shiftKey) {
  const field = fields.find(f => f.id === dragState.field);

  if (field) {
    const dx = Math.abs(nextX - field.x);
    const dy = Math.abs(nextY - field.y);

    if (dx > dy) {
      nextY = field.y;
    } else {
      nextX = field.x;
    }
  }
}

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

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp);

  return () => {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
  };

}, [dragState, zoom, fitZoom]);

useEffect(() => {
  if (!rotateState) return;

  const handleMove = (event: PointerEvent) => {
    const field = fields.find((f) => f.id === rotateState.field);
    if (!field) return;

    const page = pageRefs.current[field.pageNumber ?? 1];
    if (!page) return;

    const rect = page.getBoundingClientRect();

    const zoomScale = zoom * fitZoom;

const centerX =
  rect.left + (field.x + field.width / 2) * zoomScale;

const centerY =
  rect.top + ((field.y + (field.height ?? 50) / 2) * zoomScale);

    const angle =
      Math.atan2(event.clientY - centerY, event.clientX - centerX) *
      (180 / Math.PI);

    let rotation = angle + 90;

if (!event.shiftKey) {
  rotation = Math.round(rotation / 15) * 15;
}

updateField(field.id, {
  rotation,
});
  };

  const handleUp = () => setRotateState(null);

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp);

  return () => {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
  };
}, [rotateState, fields, zoom, fitZoom]);

  const [dragPlaceholder, setDragPlaceholder] = useState<{
  field: string;
  label: string;
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Delete") {
  event.preventDefault();

  if (selectedField) {
    removeSelected();
  }

  return;
}

if (event.ctrlKey && event.key.toLowerCase() === "c") {
  event.preventDefault();

  copiedField.current =
    fields.find((f) => f.id === selectedField) ?? null;

  return;
}

if (event.ctrlKey && event.key.toLowerCase() === "v") {
  event.preventDefault();

  if (!copiedField.current) return;

  const copy: EditorFieldConfig = {
    ...copiedField.current,
    id: createEditorFieldId(
      copiedField.current.field,
      fields.length
    ),
    x: copiedField.current.x + 20,
    y: copiedField.current.y + 20
  };

  setHistory((prev) => [...prev, fields]);
  setFields((prev) => [...prev, copy]);
  setSelectedField(copy.id);

  return;
}

if (event.ctrlKey && event.key.toLowerCase() === "d") {
  event.preventDefault();

  const field = fields.find(f => f.id === selectedField);

  if (!field) return;

  const copy: EditorFieldConfig = {
    ...field,
    id: createEditorFieldId(field.field, fields.length),
    x: field.x + 20,
    y: field.y + 20
  };

  setFields(prev => [...prev, copy]);
  setSelectedField(copy.id);

  return;
}

if (
  ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
) {
  if (!selectedField) return;
  const selectedPlaceholder = fields.find(
  (f) => f.id === selectedField
);

console.log("Locked:", selectedPlaceholder?.locked);

if (selectedPlaceholder?.locked) {
  event.preventDefault();
  return;
}

  event.preventDefault();

  const step = event.shiftKey ? 10 : 1;

  setFields((current) =>
    current.map((field) => {
      if (field.id !== selectedField) return field;

      switch (event.key) {
        case "ArrowUp":
          return { ...field, y: field.y - step };

        case "ArrowDown":
          return { ...field, y: field.y + step };

        case "ArrowLeft":
          return { ...field, x: field.x - step };

        case "ArrowRight":
          return { ...field, x: field.x + step };

        default:
          return field;
      }
    })
  );

  return;
}

if (event.ctrlKey && event.key.toLowerCase() === "z") {
  event.preventDefault();

  if (history.length === 0) {
    return;
  }

  const previous = history[history.length - 1];

  setFields(previous);

  setHistory((prev) => prev.slice(0, -1));

  return;
}
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
  }, [selectedField, fields, history]);

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

const detectExcelFields = async () => {
  if (!excelFile) {
    alert("Upload an Excel file first.");
    return;
  }

  try {
    setDetectingFields(true);

    const form = new FormData();

    form.append("excelFile", excelFile);

    const response = await apiFetch<{
      fields: {
        field: string;
        label: string;
      }[];
    }>("/certificate-templates/extract-fields", {
      method: "POST",
      body: form
    });

    setAvailableFields(response.fields);
    console.log("Detected Fields:", response.fields);
  } catch (err) {
    alert(
      err instanceof Error
        ? err.message
        : "Failed to detect fields"
    );
  } finally {
    setDetectingFields(false);
  }
};

  const addField = (fieldName: string) => {
    const normalizedField = fieldName.trim();
    if (fields.some((f) => f.field === normalizedField)) {
  return;
}
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
  width: getPlaceholderFieldWidth(normalizedField),
  height: 50,
  locked: false,
};

    setSelectedField(id);
    setHistory((prev) => [...prev, fields]);

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
      width: getFreeTextFieldWidth(nextText),
      height: 50,
      locked: false,
    };

    setSelectedField(id);
    setHistory((prev) => [...prev, fields]);

setFields((current) => [...current, nextField]);
  };
const autoArrangeFields = () => {

  if (availableFields.length === 0) return;

  const startX = stageWidth * 0.25;

  let currentY = stageHeight * 0.28;

  const gap = 70;

  const generated: EditorFieldConfig[] = [];

  availableFields.forEach((item, index) => {

  let x = stageWidth / 2 - 120;

  let y = stageHeight / 2;

  const field = item.field.toLowerCase();

  if (field.includes("name")) {
    y = stageHeight * 0.45;
  }

  else if (field.includes("course")) {
    y = stageHeight * 0.55;
  }

  else if (field.includes("department")) {
    y = stageHeight * 0.60;
  }

  else if (field.includes("college")) {
    y = stageHeight * 0.65;
  }

  else if (field.includes("roll")) {
    x = stageWidth * 0.18;
    y = stageHeight * 0.78;
  }

  else if (field.includes("score")) {
    x = stageWidth * 0.72;
    y = stageHeight * 0.78;
  }

  else if (field.includes("date")) {
    x = stageWidth * 0.70;
    y = stageHeight * 0.90;
  }

  generated.push({

    ...defaultFieldStyle,

    id: createEditorFieldId(item.field, index),

    field: item.field,

    pageNumber: activePage,

    x,

    y,

    width: getPlaceholderFieldWidth(item.field),

  });

    currentY += gap;

  });

  setFields(generated);

  setSelectedField(generated[0]?.id ?? null);

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

  setHistory((prev) => [...prev, fields]);

  setFields((current) =>
    current.filter((field) => field.id !== selectedField)
  );

  setSelectedField(null);
};

const bringForward = () => {
  if (!selectedField) return;

  setFields((current) => {
    const index = current.findIndex((f) => f.id === selectedField);

    if (index === current.length - 1) return current;

    const next = [...current];

    [next[index], next[index + 1]] = [next[index + 1], next[index]];

    return next;
  });
};

const sendBackward = () => {
  if (!selectedField) return;

  setFields((current) => {
    const index = current.findIndex((f) => f.id === selectedField);

    if (index <= 0) return current;

    const next = [...current];

    [next[index], next[index - 1]] = [next[index - 1], next[index]];

    return next;
  });
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
                onDragOver={(event) => {
  event.preventDefault();
}}

onDrop={(event) => {
  event.preventDefault();

  if (!dragPlaceholder) return;

  const rect = event.currentTarget.getBoundingClientRect();

  const x =
    (event.clientX - rect.left) / displayZoom;

  const y =
    (event.clientY - rect.top) / displayZoom;

  const id = createEditorFieldId(
    dragPlaceholder.field,
    fields.length
  );

  const newField: EditorFieldConfig = {
    ...defaultFieldStyle,
    id,
    field: dragPlaceholder.field,
    pageNumber: page.pageNumber,
    x,
    y,
    width: getPlaceholderFieldWidth(
  dragPlaceholder.field
),
height: 50,
  };

  setFields((prev) => [...prev, newField]);

  setSelectedField(id);

  setDragPlaceholder(null);
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
                {showGuides && guideLines.vertical !== null && (

<div
className="absolute top-0 bottom-0 w-[2px] bg-blue-500 opacity-70 pointer-events-none"
style={{
left: guideLines.vertical * displayZoom
}}
/>

)}

{showGuides && guideLines.horizontal !== null && (

<div
className="absolute left-0 right-0 h-[2px] bg-blue-500 opacity-70 pointer-events-none"
style={{
top: guideLines.horizontal * displayZoom
}}
/>

)}

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
                      onDoubleClick={() => {
  setEditingField(field.id);
}}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          setSelectedField(field.id);
                          setActivePage(field.pageNumber ?? 1);
                        }
                      }}
                      onPointerDown={(event) => {
                      event.preventDefault();
                      if (field.locked) return;
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
                      className={`absolute flex items-center justify-center cursor-grab active:cursor-grabbing select-none rounded-md px-1 py-0.5 transition-all duration-75 ${
                        isSelected
                          ? 'ring-2 ring-accent-500 ring-offset-2 ring-offset-transparent'
                          : 'hover:ring-1 hover:ring-accent-200'
                      }`}
                      style={{
  left: field.x * displayZoom,
  top: field.y * displayZoom,
  width: field.width * displayZoom,
  height: (field.height ?? 50) * displayZoom,
  fontSize: field.fontSize * displayZoom,
  color: field.color,
  fontWeight: field.fontWeight ?? "normal",
  fontStyle: field.fontStyle ?? "normal",
  transform: `rotate(${field.rotation ?? 0}deg)`,
transformOrigin: "center",
  textDecoration: field.textDecoration ?? "none",
  fontFamily: field.fontFamily,
  textAlign: field.align,
  lineHeight: 1.1
}}
                    >
                      {isSelected ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                          event.stopPropagation();
                            removeSelected();
                          }}
                          className="absolute -right-3 -top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 shadow-md transition hover:bg-red-50"
                          aria-label={`Remove ${field.field}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                      {editingField === field.id ? (
  <input
    autoFocus
    value={field.text ?? displayText}
    onChange={(e) => {
      updateField(field.id, {
        text: e.target.value,
      });
    }}
    onBlur={() => setEditingField(null)}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        setEditingField(null);
      }
    }}
    className="w-full border-none bg-transparent text-center outline-none"
  />
) : (
  <>
    <span
      className={`pointer-events-none block bg-white/0 ${
        isFreeText
          ? "whitespace-pre-wrap break-words"
          : "whitespace-nowrap"
      }`}
    >
      {displayText}
    </span>

    {isSelected && (
  <>
    <div
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();

        setRotateState({
          field: field.id,
          startAngle: field.rotation ?? 0,
        });
      }}
      className="absolute left-1/2 -top-8 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white bg-green-500 shadow cursor-grab"
    />

    {[
        { h: "left", c: "-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize" },
        { h: "right", c: "-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize" },
        { h: "top", c: "left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize" },
        { h: "bottom", c: "left-1/2 -bottom-2 -translate-x-1/2 cursor-ns-resize" },
        { h: "top-left", c: "-left-2 -top-2 cursor-nwse-resize" },
        { h: "top-right", c: "-right-2 -top-2 cursor-nesw-resize" },
        { h: "bottom-left", c: "-left-2 -bottom-2 cursor-nesw-resize" },
        { h: "bottom-right", c: "-right-2 -bottom-2 cursor-nwse-resize" }
      ].map((item) => (
        <div
          key={item.h}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (field.locked) return;

            setResizeState({
  field: field.id,
  handle: item.h,
  startX: event.clientX,
  startY: event.clientY,
  startWidth: field.width,
  startLeft: field.x,
  startTop: field.y,
startHeight: field.height ?? 50,
startFontSize: field.fontSize
});
          }}
          className={`absolute h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow ${item.c}`}
        />
      ))}
  </>
)}
  </>
)}
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
              <div className="mt-5 space-y-3">

  <label className="text-sm font-medium">
    Excel File
  </label>

  <input
    type="file"
    accept=".xlsx,.xls,.csv"
    onChange={(e) =>
      setExcelFile(e.target.files?.[0] ?? null)
    }
    className="w-full rounded-xl border border-slate-200 p-3"
  />

  <Button
    type="button"
    onClick={detectExcelFields}
    disabled={detectingFields}
    className="w-full"
  >
    <FileSpreadsheet className="mr-2 h-4 w-4" />

    {detectingFields
      ? "Detecting..."
      : "Detect Excel Fields"}
  </Button>

</div>
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

  {availableFields.length === 0 ? (

    <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
      No AI fields detected.
      <br />
      Upload an Excel file above.
    </div>

  ) : (

    availableFields.map((item) => (

      <button
  key={item.field}
  type="button"
  draggable

  onDragStart={() => {
    setDragPlaceholder({
      field: item.field,
      label: item.label
    });
  }}

  onDragEnd={() => {
    setDragPlaceholder(null);
  }}

  onClick={() => addField(item.field)}

  className="flex w-full cursor-grab items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-ink transition hover:border-accent-300 hover:bg-accent-50 active:cursor-grabbing"
>
        <span>{item.label}</span>
        <Plus className="h-4 w-4 text-accent-600" />
      </button>

    ))

  )}
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
          <Button
  type="button"
  variant="secondary"
  className="mb-5 w-full"
  onClick={() => autoArrangeFields()}
>
  <Wand2 className="mr-2 h-4 w-4" />
  Auto Arrange Fields
</Button>
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
  <div className="space-y-3">

    <button
      type="button"
      onClick={removeSelected}
      className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium"
    >
      <Trash2 className="h-4 w-4" />
      Remove
    </button>

    <div className="grid grid-cols-2 gap-2">

      <Button
        type="button"
        variant="secondary"
        onClick={bringForward}
      >
        Front
      </Button>

      <Button
        type="button"
        variant="secondary"
        onClick={sendBackward}
      >
        Back
      </Button>

      <Button
  type="button"
  variant="secondary"
  onClick={() =>
    updateField(selected.id, {
      locked: !selected.locked,
    })
  }
>
  {selected.locked ? "🔓 Unlock" : "🔒 Lock"}
</Button>

    </div>

  </div>
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
              <div>
  <label className="mb-2 block text-sm font-medium text-slate-700">
    Height
  </label>

  <Input
    type="number"
    value={selected.height ?? 50}
    onChange={(event) =>
      updateField(selected.id, {
        height: Number(event.target.value)
      })
    }
  />
</div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Font size</label>
              <>
  <input
    type="range"
    min={8}
    max={120}
    value={selected.fontSize}
    onChange={(e) =>
      updateField(selected.id, {
        fontSize: Number(e.target.value),
      })
    }
    className="w-full"
  />

  <Input
    type="number"
    value={selected.fontSize}
    onChange={(e) =>
      updateField(selected.id, {
        fontSize: Number(e.target.value),
      })
    }
  />
</>
            </div>
            <div>
  <label className="mb-2 block text-sm font-medium text-slate-700">
    Rotation
  </label>

  <input
    type="range"
    min={-180}
    max={180}
    value={selected.rotation ?? 0}
    onChange={(e) =>
      updateField(selected.id, {
        rotation: Number(e.target.value),
      })
    }
    className="w-full"
  />

  <Input
    type="number"
    value={selected.rotation ?? 0}
    onChange={(e) =>
      updateField(selected.id, {
        rotation: Number(e.target.value),
      })
    }
  />
</div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Font family</label>
              <select
  value={selected.fontFamily}
  onChange={(e) =>
    updateField(selected.id, {
      fontFamily: e.target.value
    })
  }
  className="w-full rounded-xl border border-slate-200 p-2"
>
  <option>Arial</option>
  <option>Times New Roman</option>
  <option>Calibri</option>
  <option>Georgia</option>
  <option>Verdana</option>
  <option>Tahoma</option>
  <option>Courier New</option>
</select>
<div>
  <label className="mb-2 block text-sm font-medium text-slate-700">
    Alignment
  </label>

  <div className="flex gap-2">
    {["left", "center", "right"].map((align) => (
      <Button
        key={align}
        type="button"
        variant={selected.align === align ? "primary" : "ghost"}
        onClick={() =>
          updateField(selected.id, {
            align: align as "left" | "center" | "right",
          })
        }
      >
        {align}
      </Button>
    ))}
  </div>
</div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Color</label>
              <input
  type="color"
  value={selected.color}
  onChange={(e) =>
    updateField(selected.id, {
      color: e.target.value,
    })
  }
  className="h-10 w-full cursor-pointer rounded-lg border border-slate-200"
/>
            </div>
<div className="mt-4 flex gap-2">
  <Button
  type="button"
  variant={selected.fontWeight === "bold" ? "primary" : "ghost"}
  onClick={() =>
    updateField(selected.id, {
      fontWeight:
        selected.fontWeight === "bold"
          ? "normal"
          : "bold",
    })
  }
  className="w-12 h-12 text-xl font-bold"
>
  B
</Button>
<Button
  type="button"
  variant={selected.fontStyle === "italic" ? "primary" : "ghost"}
  onClick={() =>
    updateField(selected.id, {
      fontStyle:
        selected.fontStyle === "italic"
          ? "normal"
          : "italic",
    })
  }
  className="w-12 h-12 text-xl italic"
>
  I
</Button>
<Button
  type="button"
  variant={
    selected.textDecoration === "underline"
      ? "primary"
      : "ghost"
  }
  onClick={() =>
    updateField(selected.id, {
      textDecoration:
        selected.textDecoration === "underline"
          ? "none"
          : "underline",
    })
  }
  className="w-12 h-12 text-xl underline"
>
  U
</Button>
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
