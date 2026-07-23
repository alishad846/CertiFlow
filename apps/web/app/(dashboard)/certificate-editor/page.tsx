'use client';

import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState
} from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Grip,
  ImagePlus,
  Mail,
  MousePointer2,
  Plus,
  Redo2,
  Save,
  ScanText,
  Send,
  Trash2,
  Type,
  Undo2,
  UserRound,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

type TextAlignment = 'left' | 'center' | 'right';
type EditorMode = 'select' | 'pan';
type InteractionMode = 'drag' | 'resize' | null;

type CertificateField = {
  id: string;
  type: 'text' | 'dynamic';
  dynamicKey?: 'name' | 'email' | 'course' | 'date';
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  align: TextAlignment;
  fontWeight: '400' | '500' | '600' | '700';
};

type AssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type HistorySnapshot = {
  fields: CertificateField[];
  backgroundImage: string | null;
};

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

const dynamicFieldOptions = [
  {
    key: 'name' as const,
    label: 'Name',
    value: '{{Name}}',
    icon: UserRound
  },
  {
    key: 'email' as const,
    label: 'Email',
    value: '{{Email}}',
    icon: Mail
  },
  {
    key: 'course' as const,
    label: 'Course',
    value: '{{Course}}',
    icon: Type
  },
  {
    key: 'date' as const,
    label: 'Date',
    value: '{{Date}}',
    icon: CalendarDays
  }
];

const initialFields: CertificateField[] = [
  {
    id: 'certificate-title',
    type: 'text',
    text: 'CERTIFICATE OF COMPLETION',
    x: 240,
    y: 150,
    width: 720,
    height: 70,
    fontFamily: 'Georgia',
    fontSize: 42,
    color: '#0f172a',
    align: 'center',
    fontWeight: '700'
  },
  {
    id: 'presented-to',
    type: 'text',
    text: 'This certificate is proudly presented to',
    x: 300,
    y: 255,
    width: 600,
    height: 45,
    fontFamily: 'Inter',
    fontSize: 20,
    color: '#64748b',
    align: 'center',
    fontWeight: '400'
  },
  {
    id: 'recipient-name',
    type: 'dynamic',
    dynamicKey: 'name',
    text: '{{Name}}',
    x: 260,
    y: 320,
    width: 680,
    height: 80,
    fontFamily: 'Georgia',
    fontSize: 48,
    color: '#2563eb',
    align: 'center',
    fontWeight: '600'
  },
  {
    id: 'course-description',
    type: 'text',
    text: 'For successfully completing',
    x: 330,
    y: 425,
    width: 540,
    height: 40,
    fontFamily: 'Inter',
    fontSize: 18,
    color: '#64748b',
    align: 'center',
    fontWeight: '400'
  },
  {
    id: 'course-name',
    type: 'dynamic',
    dynamicKey: 'course',
    text: '{{Course}}',
    x: 320,
    y: 480,
    width: 560,
    height: 60,
    fontFamily: 'Inter',
    fontSize: 30,
    color: '#0f172a',
    align: 'center',
    fontWeight: '600'
  },
  {
    id: 'issue-date',
    type: 'dynamic',
    dynamicKey: 'date',
    text: '{{Date}}',
    x: 170,
    y: 650,
    width: 260,
    height: 44,
    fontFamily: 'Inter',
    fontSize: 18,
    color: '#334155',
    align: 'center',
    fontWeight: '500'
  },
  {
    id: 'signature',
    type: 'text',
    text: 'Authorised Signature',
    x: 770,
    y: 650,
    width: 260,
    height: 44,
    fontFamily: 'Inter',
    fontSize: 18,
    color: '#334155',
    align: 'center',
    fontWeight: '500'
  }
];

function cloneFields(fields: CertificateField[]) {
  return fields.map((field) => ({ ...field }));
}

export default function CertificateEditorPage() {
  const [templateName, setTemplateName] = useState(
    'Main Certificate Template'
  );
  const [fields, setFields] =
    useState<CertificateField[]>(initialFields);
  const [selectedFieldId, setSelectedFieldId] =
    useState<string | null>('recipient-name');
  const [backgroundImage, setBackgroundImage] =
    useState<string | null>(null);
  const [zoom, setZoom] = useState(0.7);
  const [editorMode, setEditorMode] =
    useState<EditorMode>('select');
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [assistantInput, setAssistantInput] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] =
    useState<string | null>(null);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);
  const [saveMessage, setSaveMessage] = useState('');

  const [assistantMessages, setAssistantMessages] = useState<
    AssistantMessage[]
  >([
    {
      role: 'assistant',
      content:
        'Select any text on the certificate and I can help you format or position it.'
    }
  ]);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<{
    mode: InteractionMode;
    fieldId: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const panRef = useRef<{
    startClientX: number;
    startClientY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const selectedField =
    fields.find((field) => field.id === selectedFieldId) ?? null;

  const captureSnapshot = (): HistorySnapshot => ({
    fields: cloneFields(fields),
    backgroundImage
  });

  const pushHistory = () => {
    setHistory((current) => [...current.slice(-39), captureSnapshot()]);
    setFuture([]);
  };

  const updateSelectedField = (
    changes: Partial<CertificateField>,
    recordHistory = true
  ) => {
    if (!selectedFieldId) return;

    if (recordHistory) {
      pushHistory();
    }

    setFields((current) =>
      current.map((field) =>
        field.id === selectedFieldId
          ? { ...field, ...changes }
          : field
      )
    );
  };

  const addTextField = () => {
    pushHistory();

    const newField: CertificateField = {
      id: `text-${Date.now()}`,
      type: 'text',
      text: 'Double-click to edit',
      x: 400,
      y: 360,
      width: 400,
      height: 60,
      fontFamily: 'Inter',
      fontSize: 28,
      color: '#0f172a',
      align: 'center',
      fontWeight: '500'
    };

    setFields((current) => [...current, newField]);
    setSelectedFieldId(newField.id);
    setEditorMode('select');
  };

  const addDynamicField = (
    key: 'name' | 'email' | 'course' | 'date',
    value: string
  ) => {
    pushHistory();

    const newField: CertificateField = {
      id: `${key}-${Date.now()}`,
      type: 'dynamic',
      dynamicKey: key,
      text: value,
      x: 400,
      y: 360,
      width: 400,
      height: 60,
      fontFamily: 'Inter',
      fontSize: key === 'name' ? 36 : 24,
      color: '#2563eb',
      align: 'center',
      fontWeight: '600'
    };

    setFields((current) => [...current, newField]);
    setSelectedFieldId(newField.id);
    setEditorMode('select');
  };

  const deleteSelectedField = () => {
    if (!selectedFieldId) return;

    pushHistory();
    setFields((current) =>
      current.filter((field) => field.id !== selectedFieldId)
    );
    setSelectedFieldId(null);
    setEditingFieldId(null);
  };

  const handleUndo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;

    setFuture((current) => [captureSnapshot(), ...current]);
    setFields(cloneFields(previous.fields));
    setBackgroundImage(previous.backgroundImage);
    setHistory((current) => current.slice(0, -1));
    setSelectedFieldId(null);
  };

  const handleRedo = () => {
    const next = future[0];
    if (!next) return;

    setHistory((current) => [...current, captureSnapshot()]);
    setFields(cloneFields(next.fields));
    setBackgroundImage(next.backgroundImage);
    setFuture((current) => current.slice(1));
    setSelectedFieldId(null);
  };

  const handleBackgroundUpload = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    pushHistory();

    const reader = new FileReader();
    reader.onload = () => {
      setBackgroundImage(String(reader.result));
    };
    reader.readAsDataURL(file);

    event.target.value = '';
  };

  const handleFieldPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    field: CertificateField,
    mode: 'drag' | 'resize'
  ) => {
    if (editorMode === 'pan' || editingFieldId === field.id) return;

    event.preventDefault();
    event.stopPropagation();

    setSelectedFieldId(field.id);
    pushHistory();

    interactionRef.current = {
      mode,
      fieldId: field.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: field.x,
      startY: field.y,
      startWidth: field.width,
      startHeight: field.height
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleInteractionMove = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const interaction = interactionRef.current;
    if (!interaction) return;

    const deltaX =
      (event.clientX - interaction.startClientX) / zoom;
    const deltaY =
      (event.clientY - interaction.startClientY) / zoom;

    setFields((current) =>
      current.map((field) => {
        if (field.id !== interaction.fieldId) return field;

        if (interaction.mode === 'drag') {
          const nextX = Math.max(
            0,
            Math.min(
              CANVAS_WIDTH - field.width,
              interaction.startX + deltaX
            )
          );

          const nextY = Math.max(
            0,
            Math.min(
              CANVAS_HEIGHT - field.height,
              interaction.startY + deltaY
            )
          );

          return {
            ...field,
            x: nextX,
            y: nextY
          };
        }

        return {
          ...field,
          width: Math.max(
            100,
            Math.min(
              CANVAS_WIDTH - field.x,
              interaction.startWidth + deltaX
            )
          ),
          height: Math.max(
            34,
            Math.min(
              CANVAS_HEIGHT - field.y,
              interaction.startHeight + deltaY
            )
          )
        };
      })
    );
  };

  const endInteraction = () => {
    interactionRef.current = null;
  };

  const handleViewportPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (editorMode !== 'pan' || !viewportRef.current) return;

    event.preventDefault();

    panRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleViewportPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (!panRef.current || !viewportRef.current) return;

    viewportRef.current.scrollLeft =
      panRef.current.scrollLeft -
      (event.clientX - panRef.current.startClientX);

    viewportRef.current.scrollTop =
      panRef.current.scrollTop -
      (event.clientY - panRef.current.startClientY);
  };

  const endPan = () => {
    panRef.current = null;
  };

  const handleSave = () => {
    window.localStorage.setItem(
      'certiflow-visual-template',
      JSON.stringify({
        templateName,
        fields,
        backgroundImage
      })
    );

    setSaveMessage('Template saved');
    window.setTimeout(() => setSaveMessage(''), 2000);
  };

  const handleExtractText = () => {
    setAssistantMessages((current) => [
      ...current,
      {
        role: 'assistant',
        content:
          backgroundImage
            ? 'The certificate is ready for text extraction. Connect this button to your OCR API to automatically detect text positions.'
            : 'Upload a certificate image first, then use Extract Existing Text.'
      }
    ]);
  };

  const handleAssistantSubmit = () => {
    const question = assistantInput.trim();
    if (!question) return;

    const normalized = question.toLowerCase();
    let answer =
      'Select a text field to change its font, size, colour, alignment or position. Double-click the text to edit it.';

    if (normalized.includes('name')) {
      answer =
        'Choose Name under Dynamic fields. It will insert a {{Name}} placeholder that can be replaced for every recipient.';
    } else if (
      normalized.includes('move') ||
      normalized.includes('drag')
    ) {
      answer =
        'Use the Select tool, click a text field and drag it to the required position.';
    } else if (
      normalized.includes('resize') ||
      normalized.includes('size')
    ) {
      answer =
        'Select a field and drag its blue bottom-right resize handle. Font size can also be changed from the side panel.';
    } else if (normalized.includes('upload')) {
      answer =
        'Click Upload certificate in the left panel and choose a PNG, JPG or WebP image.';
    } else if (normalized.includes('save')) {
      answer =
        'Click Save Template in the top-right corner. The current design will be saved in this browser.';
    }

    setAssistantMessages((current) => [
      ...current,
      { role: 'user', content: question },
      { role: 'assistant', content: answer }
    ]);

    setAssistantInput('');
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isTyping) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        deleteSelectedField();
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault();

        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white text-slate-900 shadow-[0_18px_60px_rgba(15,23,42,0.10)]">
      {/* Top toolbar */}
      <header className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <div className="min-w-[220px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
            Certificate editor
          </p>

          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            className="mt-1 w-full bg-transparent text-base font-semibold text-slate-900 outline-none"
            aria-label="Template name"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Undo"
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={future.length === 0}
            title="Redo"
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() =>
                setZoom((current) =>
                  Math.max(0.35, Number((current - 0.1).toFixed(2)))
                )
              }
              className="grid h-10 w-9 place-items-center text-slate-600 hover:text-blue-600"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <span className="min-w-14 text-center text-xs font-semibold text-slate-600">
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              onClick={() =>
                setZoom((current) =>
                  Math.min(1.5, Number((current + 0.1).toFixed(2)))
                )
              }
              className="grid h-10 w-9 place-items-center text-slate-600 hover:text-blue-600"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Save className="h-4 w-4" />
            {saveMessage || 'Save Template'}
          </button>

          <button
            type="button"
            onClick={() => setAssistantOpen((current) => !current)}
            className={[
              'grid h-10 w-10 place-items-center rounded-xl border',
              assistantOpen
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 text-slate-600'
            ].join(' ')}
            aria-label="Toggle AI assistant"
          >
            {assistantOpen ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      <div
        className={[
          'grid min-h-[720px]',
          assistantOpen
            ? 'grid-cols-[260px_minmax(0,1fr)_300px]'
            : 'grid-cols-[260px_minmax(0,1fr)]'
        ].join(' ')}
      >
        {/* Editing controls */}
        <aside className="overflow-y-auto border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Design tools
            </p>
          </div>

          <div className="space-y-5 p-4">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100">
              <ImagePlus className="h-4 w-4" />
              Upload certificate
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleBackgroundUpload}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={addTextField}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100">
                <Plus className="h-4 w-4" />
              </div>
              Add text
            </button>

            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Dynamic fields
              </p>

              <div className="grid grid-cols-2 gap-2">
                {dynamicFieldOptions.map((option) => {
                  const Icon = option.icon;

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() =>
                        addDynamicField(option.key, option.value)
                      }
                      className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-xs font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <button
              type="button"
              onClick={handleExtractText}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ScanText className="h-5 w-5 text-blue-600" />
              Extract Existing Text
            </button>

            <section className="border-t border-slate-200 pt-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Text properties
                </p>

                {selectedField ? (
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-600">
                    Selected
                  </span>
                ) : null}
              </div>

              {selectedField ? (
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">
                      Text
                    </span>
                    <textarea
                      value={selectedField.text}
                      rows={2}
                      onChange={(event) =>
                        updateSelectedField(
                          { text: event.target.value },
                          false
                        )
                      }
                      onFocus={pushHistory}
                      className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">
                      Font family
                    </span>
                    <select
                      value={selectedField.fontFamily}
                      onChange={(event) =>
                        updateSelectedField({
                          fontFamily: event.target.value
                        })
                      }
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                    >
                      <option value="Inter">Inter</option>
                      <option value="Arial">Arial</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Times New Roman">
                        Times New Roman
                      </option>
                      <option value="Verdana">Verdana</option>
                      <option value="Courier New">Courier New</option>
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label>
                      <span className="mb-1.5 block text-xs font-medium text-slate-600">
                        Font size
                      </span>
                      <input
                        type="number"
                        min={8}
                        max={120}
                        value={selectedField.fontSize}
                        onChange={(event) =>
                          updateSelectedField({
                            fontSize: Number(event.target.value)
                          })
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                      />
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-medium text-slate-600">
                        Text colour
                      </span>
                      <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-2">
                        <input
                          type="color"
                          value={selectedField.color}
                          onChange={(event) =>
                            updateSelectedField({
                              color: event.target.value
                            })
                          }
                          className="h-7 w-8 cursor-pointer border-0 bg-transparent"
                        />
                        <span className="truncate text-[11px] text-slate-500">
                          {selectedField.color}
                        </span>
                      </div>
                    </label>
                  </div>

                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">
                      Alignment
                    </span>

                    <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200">
                      {[
                        { value: 'left' as const, icon: AlignLeft },
                        { value: 'center' as const, icon: AlignCenter },
                        { value: 'right' as const, icon: AlignRight }
                      ].map((alignment) => {
                        const Icon = alignment.icon;

                        return (
                          <button
                            key={alignment.value}
                            type="button"
                            onClick={() =>
                              updateSelectedField({
                                align: alignment.value
                              })
                            }
                            className={[
                              'grid h-10 place-items-center border-r border-slate-200 last:border-r-0',
                              selectedField.align === alignment.value
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-slate-500 hover:bg-slate-50'
                            ].join(' ')}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={deleteSelectedField}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs leading-5 text-slate-500">
                  Select a text field on the certificate to edit its
                  appearance.
                </div>
              )}
            </section>
          </div>
        </aside>

        {/* Main certificate canvas */}
        <main className="relative flex min-w-0 flex-col bg-slate-100">
          <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditorMode('select')}
                className={[
                  'inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-semibold',
                  editorMode === 'select'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                ].join(' ')}
              >
                <MousePointer2 className="h-4 w-4" />
                Select
              </button>

              <button
                type="button"
                onClick={() => setEditorMode('pan')}
                className={[
                  'inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-semibold',
                  editorMode === 'pan'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                ].join(' ')}
              >
                <Grip className="h-4 w-4" />
                Move canvas
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Double-click text to edit · Drag to move · Use handle to
              resize
            </p>
          </div>

          <div
            ref={viewportRef}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedFieldId(null);
                setEditingFieldId(null);
              }
            }}
            className={[
              'relative flex flex-1 overflow-auto p-16',
              editorMode === 'pan'
                ? 'cursor-grab active:cursor-grabbing'
                : 'cursor-default'
            ].join(' ')}
          >
            <div
              className="m-auto shrink-0"
              style={{
                width: CANVAS_WIDTH * zoom,
                height: CANVAS_HEIGHT * zoom
              }}
            >
              <div
                className="relative origin-top-left overflow-hidden bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
                style={{
                  width: CANVAS_WIDTH,
                  height: CANVAS_HEIGHT,
                  transform: `scale(${zoom})`,
                  backgroundImage: backgroundImage
                    ? `url("${backgroundImage}")`
                    : undefined,
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '100% 100%'
                }}
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setSelectedFieldId(null);
                    setEditingFieldId(null);
                  }
                }}
              >
                {!backgroundImage ? (
                  <>
                    <div className="pointer-events-none absolute inset-8 border-2 border-blue-600/30" />
                    <div className="pointer-events-none absolute inset-12 border border-amber-500/50" />
                    <div className="pointer-events-none absolute left-1/2 top-12 h-2 w-36 -translate-x-1/2 rounded-full bg-blue-600" />
                    <div className="pointer-events-none absolute bottom-12 left-1/2 h-2 w-36 -translate-x-1/2 rounded-full bg-amber-500" />
                  </>
                ) : null}

                {fields.map((field) => {
                  const isSelected = selectedFieldId === field.id;
                  const isEditing = editingFieldId === field.id;

                  return (
                    <div
                      key={field.id}
                      onPointerDown={(event) =>
                        handleFieldPointerDown(event, field, 'drag')
                      }
                      onPointerMove={handleInteractionMove}
                      onPointerUp={endInteraction}
                      onPointerCancel={endInteraction}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        setSelectedFieldId(field.id);
                        setEditingFieldId(field.id);
                      }}
                      className={[
                        'absolute flex items-center',
                        editorMode === 'pan'
                          ? 'pointer-events-none'
                          : 'cursor-move',
                        isSelected
                          ? 'z-20 outline outline-2 outline-blue-500'
                          : 'z-10 hover:outline hover:outline-1 hover:outline-blue-300'
                      ].join(' ')}
                      style={{
                        left: field.x,
                        top: field.y,
                        width: field.width,
                        height: field.height,
                        fontFamily: field.fontFamily,
                        fontSize: field.fontSize,
                        color: field.color,
                        fontWeight: field.fontWeight,
                        textAlign: field.align
                      }}
                    >
                      {isEditing ? (
                        <textarea
                          autoFocus
                          value={field.text}
                          onChange={(event) =>
                            setFields((current) =>
                              current.map((currentField) =>
                                currentField.id === field.id
                                  ? {
                                      ...currentField,
                                      text: event.target.value
                                    }
                                  : currentField
                              )
                            )
                          }
                          onPointerDown={(event) =>
                            event.stopPropagation()
                          }
                          onBlur={() => setEditingFieldId(null)}
                          className="h-full w-full resize-none overflow-hidden bg-white/90 px-1 outline-none"
                          style={{
                            fontFamily: field.fontFamily,
                            fontSize: field.fontSize,
                            color: field.color,
                            fontWeight: field.fontWeight,
                            textAlign: field.align
                          }}
                        />
                      ) : (
                        <div className="w-full whitespace-pre-wrap px-1 leading-tight">
                          {field.text}
                        </div>
                      )}

                      {isSelected && !isEditing ? (
                        <>
                          <span className="pointer-events-none absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600 shadow" />
                          <span className="pointer-events-none absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600 shadow" />
                          <span className="pointer-events-none absolute -bottom-1 -left-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600 shadow" />

                          <button
                            type="button"
                            aria-label="Resize field"
                            onPointerDown={(event) =>
                              handleFieldPointerDown(
                                event,
                                field,
                                'resize'
                              )
                            }
                            onPointerMove={handleInteractionMove}
                            onPointerUp={endInteraction}
                            onPointerCancel={endInteraction}
                            className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-blue-600 shadow"
                          />
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>

        {/* AI assistant */}
        {assistantOpen ? (
          <aside className="flex min-h-0 flex-col border-l border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white">
                  <Bot className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-sm font-semibold">AI Assistant</p>
                  <p className="text-xs text-emerald-500">
                    Design helper
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAssistantOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-auto p-4">
              {assistantMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={[
                    'max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-6',
                    message.role === 'user'
                      ? 'ml-auto bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  ].join(' ')}
                >
                  {message.content}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 p-3">
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                <textarea
                  value={assistantInput}
                  rows={2}
                  placeholder="Ask about your certificate..."
                  onChange={(event) =>
                    setAssistantInput(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleAssistantSubmit();
                    }
                  }}
                  className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none"
                />

                <button
                  type="button"
                  onClick={handleAssistantSubmit}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      {/* Preview modal */}
      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-8">
          <div className="relative max-h-full max-w-full overflow-auto rounded-2xl bg-slate-100 p-8 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-700 shadow hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>

            <div
              className="relative origin-top-left overflow-hidden bg-white shadow-xl"
              style={{
                width: CANVAS_WIDTH * 0.75,
                height: CANVAS_HEIGHT * 0.75
              }}
            >
              <div
                className="relative origin-top-left bg-white"
                style={{
                  width: CANVAS_WIDTH,
                  height: CANVAS_HEIGHT,
                  transform: 'scale(0.75)',
                  backgroundImage: backgroundImage
                    ? `url("${backgroundImage}")`
                    : undefined,
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '100% 100%'
                }}
              >
                {!backgroundImage ? (
                  <>
                    <div className="absolute inset-8 border-2 border-blue-600/30" />
                    <div className="absolute inset-12 border border-amber-500/50" />
                  </>
                ) : null}

                {fields.map((field) => (
                  <div
                    key={field.id}
                    className="absolute flex items-center"
                    style={{
                      left: field.x,
                      top: field.y,
                      width: field.width,
                      height: field.height,
                      fontFamily: field.fontFamily,
                      fontSize: field.fontSize,
                      color: field.color,
                      fontWeight: field.fontWeight,
                      textAlign: field.align
                    }}
                  >
                    <div className="w-full whitespace-pre-wrap px-1 leading-tight">
                      {field.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}