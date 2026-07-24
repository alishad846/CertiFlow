'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createWorker, PSM } from 'tesseract.js';
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
  isOcrText?: boolean;
  originalOcrText?: string;
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
function normalizeOcrText(value?: string) {
  return (value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
function areOcrItemsOnSameLine(
  firstBox: { y0: number; y1: number },
  secondBox: { y0: number; y1: number },
  tolerance = 10
) {
  const firstCenterY = (firstBox.y0 + firstBox.y1) / 2;
  const secondCenterY = (secondBox.y0 + secondBox.y1) / 2;

  return Math.abs(firstCenterY - secondCenterY) <= tolerance;
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
  return fields
    .filter((field) => {
      const isUnchangedOcrText =
        field.isOcrText &&
        field.originalOcrText !== undefined &&
        field.text === field.originalOcrText;

      return !isUnchangedOcrText;
    })
    .map(
      ({
        id,
        isOcrText,
        originalOcrText,
        ...field
      }) => field
    );
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
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [issueDateMode, setIssueDateMode] = useState<CertificateIssueDateMode>(template.issueDateMode ?? 'current_date');
  const [issueDateValue, setIssueDateValue] = useState<string>(template.issueDateValue ?? new Date().toISOString().slice(0, 10));
  const [customFieldName, setCustomFieldName] = useState('');
  const [customTextValue, setCustomTextValue] = useState('');
  const [previewPages, setPreviewPages] = useState<PreviewPage[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fontSizeInput, setFontSizeInput] = useState('');
  const [fitZoom, setFitZoom] = useState(1);
  const displayZoom = zoom * fitZoom;
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [extractingText, setExtractingText] = useState(false);
  const [extractMessage, setExtractMessage] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [dragState, setDragState] = useState<{
    field: string;
    pageNumber: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [resizeState, setResizeState] = useState<{
  fieldId: string;
  pageNumber: number;
  direction: 'left' | 'right' | 'top' | 'bottom';
  startPointerX: number;
  startPointerY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startFontSize: number;
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
  current.map((field) => {
    if (field.id !== dragState.field) {
      return field;
    }

    const maximumX = Math.max(
      0,
      rect.width / displayZoom - field.width
    );

    const estimatedHeight = Math.max(
      20,
      field.fontSize * 1.4
    );

    const maximumY = Math.max(
      0,
      rect.height / displayZoom - estimatedHeight
    );

    const clampedX = Math.min(nextX, maximumX);
    const clampedY = Math.min(nextY, maximumY);

    if (
      Math.abs(field.x - clampedX) < 0.5 &&
      Math.abs(field.y - clampedY) < 0.5
    ) {
      return field;
    }

    return {
      ...field,
      x: clampedX,
      y: clampedY
    };
  })
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
  }, [dragState, displayZoom]);

  useEffect(() => {
  if (!resizeState) {
    return;
  }

  const handleResizeMove = (event: PointerEvent) => {
    const container = pageRefs.current[resizeState.pageNumber];

    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const pointerX =
  (event.clientX - rect.left) / displayZoom;

const pointerY =
  (event.clientY - rect.top) / displayZoom;

const deltaX =
  pointerX - resizeState.startPointerX;

const deltaY =
  pointerY - resizeState.startPointerY;

    setFields((current) =>
      current.map((field) => {
        if (field.id !== resizeState.fieldId) {
          return field;
        }

        if (resizeState.direction === 'right') {
  return {
    ...field,
    width: Math.max(
      30,
      resizeState.startWidth + deltaX
    )
  };
}

if (resizeState.direction === 'left') {
  const nextWidth = Math.max(
    30,
    resizeState.startWidth - deltaX
  );

  const appliedDelta =
    resizeState.startWidth - nextWidth;

  return {
    ...field,
    x: resizeState.startX + appliedDelta,
    width: nextWidth
  };
}

if (resizeState.direction === 'bottom') {
  return {
    ...field,
    fontSize: clampFontSize(
      resizeState.startFontSize + deltaY
    )
  };
}

const nextFontSize = clampFontSize(
  resizeState.startFontSize - deltaY
);

const appliedFontDifference =
  resizeState.startFontSize - nextFontSize;

return {
  ...field,
  y: Math.max(
    0,
    resizeState.startY + appliedFontDifference
  ),
  fontSize: nextFontSize
};
      })
    );
  };

  const handleResizeUp = () => {
    setResizeState(null);
  };

  window.addEventListener('pointermove', handleResizeMove);
  window.addEventListener('pointerup', handleResizeUp);

  return () => {
    window.removeEventListener('pointermove', handleResizeMove);
    window.removeEventListener('pointerup', handleResizeUp);
  };
}, [resizeState, displayZoom]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedField) {
  return;
}

if (!event.ctrlKey) {
  return;
}
        if (
  selectedField &&
  (event.key === 'Delete' || event.key === 'Backspace')
) {
  const target = event.target as HTMLElement;

  if (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  ) {
    return;
  }

  event.preventDefault();

  setFields((current) =>
    current.filter((field) => field.id !== selectedField)
  );

  setSelectedField(null);
  setEditingFieldId(null);
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
  useEffect(() => {
  if (selected) {
    setFontSizeInput(String(selected.fontSize));
  } else {
    setFontSizeInput('');
  }
}, [selected?.id, selected?.fontSize]);
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

  if (!trimmedText) {
    return;
  }

  const nextText = trimmedText;
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

   setFields((current) => [...current, nextField]);
setSelectedField(id);
setEditingFieldId(id);
  };
const addFreeTextFieldAtPosition = (
  text: string,
  pageNumber: number,
  x: number,
  y: number
) => {
  const nextText = text.trim() || DEFAULT_FREE_TEXT;
  const id = createEditorFieldId('text', fields.length);
  const fieldName = createUniqueFieldName('text', fields);

  const nextField: EditorFieldConfig = {
    ...defaultFieldStyle,
    id,
    field: fieldName,
    pageNumber,
    text: nextText,
    x,
    y,
    width: getFreeTextFieldWidth(nextText)
  };

  setFields((current) => [...current, nextField]);
  setSelectedField(id);
  setEditingFieldId(id);
  setActivePage(pageNumber);
};
const extractExistingTextFromTemplate = async () => {
  const page = pagesToRender.find((item) => item.pageNumber === activePage) ?? pagesToRender[0];

  if (!page) {
    return;
  }

  setExtractingText(true);
setOcrProgress(0);
setExtractMessage('Scanning template text...');

let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

try {
  worker = await createWorker('eng', 1, {
  logger: (message) => {
    if (
      message.status === 'recognizing text' &&
      typeof message.progress === 'number'
    ) {
      setOcrProgress(
        Math.round(message.progress * 100)
      );
    }
  }
});
  await worker.setParameters({
  tessedit_pageseg_mode: PSM.SINGLE_BLOCK
});

const result = await worker.recognize(
  page.src,
  {},
  {
    blocks: true,
    text: true
  }
);
    const sourceImage = new Image();

await new Promise<void>((resolve, reject) => {
  sourceImage.onload = () => resolve();
  sourceImage.onerror = () => reject(new Error('Could not load certificate image for OCR scaling.'));
  sourceImage.src = page.src;
});

const scaleX = page.width / sourceImage.naturalWidth;
const scaleY = page.height / sourceImage.naturalHeight;
    
    type OcrItem = {
  text?: string;
  confidence?: number;
  bbox?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  words?: OcrItem[];
};

type OcrBlock = {
  lines?: OcrItem[];
  paragraphs?: Array<{
    lines?: OcrItem[];
  }>;
};

const ocrData = result.data as unknown as {
  text?: string;
  lines?: OcrItem[];
  words?: OcrItem[];
  blocks?: OcrBlock[];
};

const lineItems = (ocrData.blocks ?? []).flatMap((block) => [
  ...(block.lines ?? []),
  ...(block.paragraphs ?? []).flatMap(
    (paragraph) => paragraph.lines ?? []
  )
]);

const candidateItems = [
  ...(ocrData.lines ?? []),
  ...lineItems
];

const detectedItems = (
  candidateItems.length
    ? candidateItems
    : (ocrData.words ?? [])
).filter((item) => {
const text = item.text?.trim();

if (!text || text.length < 3) {
  return false;
}

const upper = text.toUpperCase();

const ignoredWords = [
  "JOHNS HOPKINS",
  "JOHNS HOPKINS UNIVERSITY",
  "COURSE CERTIFICATE",
  "COURSERA",
  "PAGE",
  "SIGNATURE",
  "DATE",
  "LOGO",
  "CERTIFICATE"
];

if (
  ignoredWords.some((word) => upper.includes(word)) ||
  upper.includes("UNIVERSITY")
) {
  return false;
}


return Boolean(
  item.bbox &&
  (item.confidence ?? 100) > 70
);
});

if (!detectedItems.length) {
  setExtractMessage(
    ocrData.text?.trim()
      ? `Text found but positions were not detected: ${ocrData.text.trim()}`
      : 'No text detected. Try a clearer certificate image.'
  );
  return;
}
const sortedDetectedItems = [...detectedItems].sort((a, b) => {
  if (!a.bbox || !b.bbox) {
    return 0;
  }

  const verticalDifference = a.bbox.y0 - b.bbox.y0;

  if (Math.abs(verticalDifference) > 10) {
    return verticalDifference;
  }

  return a.bbox.x0 - b.bbox.x0;
});

const groupedDetectedItems: Array<
  Array<(typeof sortedDetectedItems)[number]>
> = [];

sortedDetectedItems.forEach((item) => {
  const text = item.text?.trim();

  if (!item.bbox || !text) {
    return;
  }

  const currentLine =
    groupedDetectedItems[groupedDetectedItems.length - 1];

  if (!currentLine) {
    groupedDetectedItems.push([item]);
    return;
  }

  const firstItemInLine = currentLine[0];

  const lastItemInLine = currentLine[currentLine.length - 1];

const horizontalGap =
  lastItemInLine?.bbox && item.bbox
    ? item.bbox.x0 - lastItemInLine.bbox.x1
    : Number.POSITIVE_INFINITY;

const isSameLine =
  firstItemInLine.bbox &&
  areOcrItemsOnSameLine(
    firstItemInLine.bbox,
    item.bbox,
    14
  );

const isReasonableGap = horizontalGap >= -5 && horizontalGap <= 80;

if (isSameLine && isReasonableGap) {
  currentLine.push(item);
} else {
  groupedDetectedItems.push([item]);
}
});
const mergedDetectedItems = groupedDetectedItems
  .map((lineItems) => {
    const sortedLineItems = [...lineItems].sort((a, b) => {
      if (!a.bbox || !b.bbox) {
        return 0;
      }

      return a.bbox.x0 - b.bbox.x0;
    });

    const validItems = sortedLineItems.filter(
      (item) => item.bbox && item.text?.trim()
    );

    const firstItem = validItems[0];

    if (!firstItem?.bbox) {
      return null;
    }

    const mergedText = validItems.reduce(
  (result, item, index) => {
    const currentText = item.text?.trim() ?? '';

    if (!currentText) {
      return result;
    }

    if (index === 0) {
      return currentText;
    }

    const previousItem = validItems[index - 1];

    if (!previousItem?.bbox || !item.bbox) {
      return `${result} ${currentText}`;
    }

    const horizontalGap =
      item.bbox.x0 - previousItem.bbox.x1;

    const shouldAvoidSpace =
      /^[,.;:!?%)]/.test(currentText) ||
      /[(]$/.test(result);

    if (shouldAvoidSpace) {
      return `${result}${currentText}`;
    }

    const spaces =
      horizontalGap > 45
        ? '   '
        : horizontalGap > 20
          ? '  '
          : ' ';

    return `${result}${spaces}${currentText}`;
  },
  ''
);
if (!mergedText.trim()) {
  return null;
}
    const x0 = Math.min(
      ...validItems.map((item) => item.bbox!.x0)
    );

    const y0 = Math.min(
      ...validItems.map((item) => item.bbox!.y0)
    );

    const x1 = Math.max(
      ...validItems.map((item) => item.bbox!.x1)
    );

    const y1 = Math.max(
      ...validItems.map((item) => item.bbox!.y1)
    );

    const confidenceValues = validItems
      .map((item) => item.confidence)
      .filter(
        (confidence): confidence is number =>
          typeof confidence === 'number'
      );

    const averageConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce(
            (total, confidence) => total + confidence,
            0
          ) / confidenceValues.length
        : 100;

    return {
      ...firstItem,
      text: mergedText,
      confidence: averageConfidence,
      bbox: {
        x0,
        y0,
        x1,
        y1,
      },
    };
  })
  .filter(
    (
      item
    ): item is NonNullable<typeof item> => item !== null
  );

const extractedFields = mergedDetectedItems
  .map((item, index): EditorFieldConfig | null => {
  const text = item.text?.trim() ?? '';
  const box = item.bbox!;
  const boxWidth = (box.x1 - box.x0) * scaleX;
const boxHeight = (box.y1 - box.y0) * scaleY;

if (boxWidth < 30 || boxHeight < 8) {
  return null;
}
  const nextX = Math.max(0, box.x0 * scaleX);
const nextY = Math.max(0, box.y0 * scaleY - 2);
const alreadyExistsInEditor = fields.some((existingField) => {
  return (
    existingField.isOcrText &&
    normalizeOcrText(existingField.text) === normalizeOcrText(text) &&
    Math.abs(existingField.x - nextX) < 10 &&
    Math.abs(existingField.y - nextY) < 10 &&
    existingField.pageNumber === page.pageNumber
  );
});

if (alreadyExistsInEditor) {
  return null;
}

const isDuplicate = mergedDetectedItems
  .slice(0, index)
  .some((previousItem) => {
    if (!previousItem.bbox) {
      return false;
    }

    const previousText = normalizeOcrText(previousItem.text);
    const previousX = Math.max(0, previousItem.bbox.x0 * scaleX);
    const previousY = Math.max(
      0,
      previousItem.bbox.y0 * scaleY - 2
    );

    return (
      previousText === normalizeOcrText(text) &&
      Math.abs(previousX - nextX) < 10 &&
      Math.abs(previousY - nextY) < 10
    );
  });

if (isDuplicate) {
  return null;
}
const safeY = Math.min(
  Math.max(0, nextY),
  Math.max(0, page.height - boxHeight)
);

    const estimatedFontSize = Math.max(
  12,
  Math.min(48, boxHeight * 0.78)
);
  return {
    ...defaultFieldStyle,
    id: createEditorFieldId('ocr-text', fields.length + index),
    field: `ocr_text_${Date.now()}_${index}`,
    isOcrText: true,
    originalOcrText: text,
    pageNumber: page.pageNumber,
    text,
    x: nextX,
    y: safeY,
    width: Math.max(
  40,
  Math.min(
    page.width - nextX,
    boxWidth + 12
  )
),
fontSize: clampFontSize(estimatedFontSize),
    align: 'left'
  };
})
  .filter(
    (field): field is EditorFieldConfig => field !== null
  );
   setFields((current) => [
  ...current.filter((field) => !field.isOcrText),
  ...extractedFields
]); 
     
    setSelectedField(extractedFields[0]?.id ?? null);
    setEditingFieldId(extractedFields[0]?.id ?? null);
    setOcrProgress(100);
    setExtractMessage(`Detected ${extractedFields.length} editable text layers.`);
  } catch (error) {
    setOcrProgress(0);

    setExtractMessage(
      error instanceof Error
        ? error.message
        : 'Failed to extract text.'
    );
  } finally {
    if (worker) {
      await worker.terminate();
    }

    setExtractingText(false);
  }
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

  setFields((current) =>
    current.filter((field) => field.id !== selectedField)
  );

  setSelectedField(null);
  setEditingFieldId(null);
  setDragState(null);
  setResizeState(null);
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
onDoubleClick={(event) => {
  if (event.target !== event.currentTarget) {
    return;
  }

  const rect = pageRefs.current[page.pageNumber]?.getBoundingClientRect();
  if (!rect) {
    return;
  }

  const x = (event.clientX - rect.left) / displayZoom;
  const y = (event.clientY - rect.top) / displayZoom;

  addFreeTextFieldAtPosition('', page.pageNumber, x, y);
}}
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
  onDoubleClick={(event) => {
    const rect = pageRefs.current[page.pageNumber]?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const x = (event.clientX - rect.left) / displayZoom;
    const y = (event.clientY - rect.top) / displayZoom;

    addFreeTextFieldAtPosition('', page.pageNumber, x, y);
  }}
/>

                <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                  Page {page.pageNumber}
                </div>

                {pageFields.map((field) => {
                  const isSelected = field.id === selectedField;
                  const isIssueDate = field.field === 'issue_date';
                  const isFreeText = typeof field.text === 'string';
                  const displayText = isFreeText ? field.text ?? '' : isIssueDate ? resolvedIssueDate : `{${field.field}}`;
                  const isUnchangedOcrText =
  field.isOcrText &&
  field.originalOcrText !== undefined &&
  field.text === field.originalOcrText;
                  return (
                    <div
                      key={`${page.pageNumber}-${field.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedField(field.id);
                        setActivePage(field.pageNumber ?? 1);
                      }}
                      onDoubleClick={(event) => {
  event.preventDefault();
  event.stopPropagation();

  setSelectedField(field.id);
  setActivePage(field.pageNumber ?? 1);
  setEditingFieldId(field.id);
}}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          setSelectedField(field.id);
                          setActivePage(field.pageNumber ?? 1);
                        }
                      }}
                      onPointerDown={(event) => {
  if (editingFieldId === field.id) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  event.currentTarget.setPointerCapture(event.pointerId);

  const rect =
    pageRefs.current[page.pageNumber]?.getBoundingClientRect();

  if (!rect) {
    return;
  }

  const pointerX =
    (event.clientX - rect.left) / displayZoom;

  const pointerY =
    (event.clientY - rect.top) / displayZoom;

  setSelectedField(field.id);
  setActivePage(field.pageNumber ?? 1);
  setEditingFieldId(null);

  setDragState({
    field: field.id,
    pageNumber: page.pageNumber,
    offsetX: pointerX - field.x,
    offsetY: pointerY - field.y
  });
}}
                       className={`absolute touch-none cursor-move select-none overflow-visible rounded-md px-1 py-0.5 ${
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
  lineHeight: field.isOcrText ? 1.25 : 1.1,
  backgroundColor: 'transparent',
  padding: 0,
}}
                    >
                      {isSelected ? (
                        <button
  type="button"
  onPointerDown={(event) => {
    event.preventDefault();
    event.stopPropagation();
  }}
  onClick={(event) => {
    event.preventDefault();
    event.stopPropagation();
  

    setFields((current) =>
      current.filter((item) => item.id !== field.id)
    );

    setSelectedField(null);
    setEditingFieldId(null);
    setDragState(null);
    setResizeState(null);
  }}
  className="absolute -right-4 -top-4 z-50 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-red-500 bg-white text-red-600 shadow-lg hover:bg-red-50"
  aria-label={`Remove ${field.field}`}
>
  <X className="pointer-events-none h-4 w-4" />
</button>
                      ) : null}
                      {isSelected ? (
  <>
    <button
      type="button"
      aria-label="Resize from left"
      className="absolute -left-2 top-1/2 z-20 h-8 w-3 -translate-y-1/2 cursor-ew-resize rounded-full border border-accent-500 bg-white shadow"
      onPointerDown={(event) => {
        event.preventDefault();
event.stopPropagation();
event.currentTarget.setPointerCapture(event.pointerId);

        const container = pageRefs.current[page.pageNumber];

        if (!container) {
          return;
        }

        const pointerX =
          (event.clientX - container.getBoundingClientRect().left) /
          displayZoom;

        setDragState(null);

        setResizeState({
  fieldId: field.id,
  pageNumber: page.pageNumber,
  direction: 'left',
  startPointerX: pointerX,
  startPointerY: 0,
  startX: field.x,
  startY: field.y,
  startWidth: field.width,
  startFontSize: field.fontSize
});
      }}
    />

    <button
      type="button"
      aria-label="Resize from right"
      className="absolute -right-2 top-1/2 z-20 h-8 w-3 -translate-y-1/2 cursor-ew-resize rounded-full border border-accent-500 bg-white shadow"
      onPointerDown={(event) => {
  if (resizeState) {
    return;
  }

  event.preventDefault();
event.stopPropagation();
event.currentTarget.setPointerCapture(event.pointerId);

        const container = pageRefs.current[page.pageNumber];

        if (!container) {
          return;
        }

        const pointerX =
          (event.clientX - container.getBoundingClientRect().left) /
          displayZoom;

        setDragState(null);

        setResizeState({
  fieldId: field.id,
  pageNumber: page.pageNumber,
  direction: 'right',
  startPointerX: pointerX,
  startPointerY: 0,
  startX: field.x,
  startY: field.y,
  startWidth: field.width,
  startFontSize: field.fontSize
});
      }}
    />
  </>
) : null}
                      {editingFieldId === field.id ? (
  <textarea
    autoFocus
    placeholder="Type your text here"
    value={isFreeText ? field.text ?? '' : field.field}
    onPointerDown={(event) => {    
  event.stopPropagation();
}}
    onFocus={(event) => {
  setSelectedField(field.id);

  if (field.text === DEFAULT_FREE_TEXT) {
    event.currentTarget.select();
  }
}}
    onChange={(event) => {
      if (isFreeText) {
        updateField(field.id, {
          text: event.target.value
        });
      } else {
        updateField(field.id, {
  field: event.target.value
});
      }
    }}
    onBlur={() => {
  setEditingFieldId(null);

  if (isFreeText && !(field.text ?? '').trim()) {
    setFields((current) =>
      current.filter((item) => item.id !== field.id)
    );

    setSelectedField(null);
  }
}}

    onKeyDown={(event) => {
      event.stopPropagation();

      if (event.key === 'Escape') {
        setEditingFieldId(null);
      }

      if (
        event.key === 'Enter' &&
        !event.shiftKey
      ) {
        event.preventDefault();
        setEditingFieldId(null);
      }
    }}
    className="relative z-20 block min-h-[32px] w-full resize-none overflow-hidden border border-blue-500 bg-white p-1 outline-none"
    style={{
      color: field.color,
      fontFamily: field.fontFamily,
      fontSize: 'inherit',
      lineHeight: 1.1,
      textAlign: field.align
    }}
  />
) : (
  <span
  className={`pointer-events-none block bg-white/0 ${
    field.isOcrText
      ? 'whitespace-nowrap overflow-hidden'
      : isFreeText
        ? 'whitespace-pre-wrap break-words'
        : 'whitespace-nowrap'
  }`}
  style={{
  opacity: isUnchangedOcrText && !isSelected ? 0 : 1,
  backgroundColor:
    field.isOcrText && !isUnchangedOcrText
      ? '#ffffff'
      : 'transparent',
  padding:
    field.isOcrText && !isUnchangedOcrText
      ? '1px 3px'
      : 0,
}}
>
    {displayText}
  </span>
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
            </div>
          </div>
          <Button
  type="button"
  className="mt-4 w-full border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-600"
  onClick={extractExistingTextFromTemplate}
  disabled={extractingText}
>
  {extractingText ? 'Extracting text...' : 'Extract existing text'}
</Button>
{extractingText ? (
  <div className="mt-3">
    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full bg-slate-900 transition-all duration-200"
        style={{
          width: `${ocrProgress}%`
        }}
      />
    </div>

    <p className="mt-2 text-xs font-medium text-slate-500">
      Scanning certificate… {ocrProgress}%
    </p>
  </div>
) : null}

{extractMessage ? (
  <p className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
    {extractMessage}
  </p>
) : null}
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
  setCustomTextValue('');
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
                max="3"
                step="0.05"
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
                onChange={(event) => updateField(selected.id, { width: Math.max(30, Number(event.target.value)) })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Font size</label>
              <Input
  type="number"
  min={MIN_FONT_SIZE}
  max={MAX_FONT_SIZE}
  value={fontSizeInput}
  onChange={(event) => {
    const value = event.target.value;

    setFontSizeInput(value);

    if (value === '') {
      return;
    }

    const nextFontSize = Number(value);

    if (Number.isFinite(nextFontSize)) {
      updateField(selected.id, {
        fontSize: clampFontSize(nextFontSize)
      });
    }
  }}
  onBlur={() => {
    if (fontSizeInput === '') {
      setFontSizeInput(String(selected.fontSize));
    }
  }}
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
<option value="Georgia">Georgia</option>
<option value="Garamond">Garamond</option>
<option value="Verdana">Verdana</option>
<option value="Tahoma">Tahoma</option>
<option value="Trebuchet MS">Trebuchet MS</option>
<option value="Courier New">Courier New</option>
<option value="Calibri">Calibri</option>
<option value="Cambria">Cambria</option>
<option value="Palatino Linotype">Palatino Linotype</option>
<option value="Book Antiqua">Book Antiqua</option>
<option value="Lucida Sans">Lucida Sans</option>
<option value="Brush Script MT">Brush Script MT</option>
<option value="Monotype Corsiva">Monotype Corsiva</option>
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
          <p className="mt-5 text-sm leading-6 text-slate-500">
            Click a placeholder to place it on the certificate, then drag it
            where you want it.
          </p>
        )}
      </section>
    </aside>
  </div>
);
}
