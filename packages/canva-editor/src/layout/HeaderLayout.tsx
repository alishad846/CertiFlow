'use client';

import {
  forwardRef,
  ForwardRefRenderFunction,
  useState,
} from 'react';
import { useEditor } from 'canva-editor/hooks';
import EditInlineInput from 'canva-editor/components/EditInlineInput';
import SettingDivider from 'canva-editor/utils/settings/components/SettingDivider';
import EditorButton from 'canva-editor/components/EditorButton';
import NextIcon from 'canva-editor/icons/NextIcon';
import BackIcon from 'canva-editor/icons/BackIcon';
import SyncedIcon from 'canva-editor/icons/SyncedIcon';
import HeaderFileMenu from './sidebar/components/HeaderFileMenu';
import SyncingIcon from 'canva-editor/icons/SyncingIcon';
import useMobileDetect from 'canva-editor/hooks/useMobileDetect';
import { useTranslate } from 'canva-editor/contexts/TranslationContext';
import { pack, dataMapping } from 'canva-editor/utils/minifier';

interface HeaderLayoutProps {
  logoUrl?: string;
  logoComponent?: React.ReactNode;
  designName: string;
  saving: boolean;
  onChanges: (str: string) => void;
  onRemove: () => void;
  onSave?: (design: unknown) => void;
  /** Home → save the design, then go to the dashboard. */
  onHomeSave?: (design: unknown) => void;
  /** Home → leave to the dashboard without saving. */
  onHomeDiscard?: () => void;
}

// CertiFlow luxury palette — kept local to the frozen fork so the editor chrome stays on-brand
// without depending on the host app's stylesheet.
const CREAM = '#EDE7DC';
const CREAM_MUTED = 'rgba(237,231,220,.55)';
const BRONZE = '#B48A5A';

const HeaderLayout: ForwardRefRenderFunction<
  HTMLDivElement,
  HeaderLayoutProps
> = ({ designName, saving, onChanges, onRemove, onSave, onHomeSave, onHomeDiscard }, ref) => {
  const [name, setName] = useState(designName);
  const [homeMenuOpen, setHomeMenuOpen] = useState(false);
  const { actions, query } = useEditor();
  const isMobile = useMobileDetect();
  const t = useTranslate();

  const serializeDesign = () => pack(query.serialize(), dataMapping)[0];

  const handleSave = () => {
    if (!onSave) return;
    // Serialize the current design in the same packed shape autosave uses, so the explicit Save
    // always persists the latest edits even if the debounced autosave has not fired yet.
    onSave(serializeDesign());
  };

  const handleHomeSave = () => {
    setHomeMenuOpen(false);
    onHomeSave?.(serializeDesign());
  };
  const handleHomeDiscard = () => {
    setHomeMenuOpen(false);
    onHomeDiscard?.();
  };

  return (
    <div
      ref={ref}
      css={{
        background: 'linear-gradient(180deg, #0B1B3A 0%, #0C1E42 100%)',
        borderBottom: `1px solid rgba(180,138,90,.35)`,
        padding: '10px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 31,
        '@media (max-width: 900px)': {
          padding: 10,
        },
      }}
    >
      {/* Home — return to the dashboard (with a save / don't-save choice). */}
      {(onHomeSave || onHomeDiscard) && (
        <div css={{ position: 'relative', marginRight: 14, display: 'flex', alignItems: 'center' }}>
          <button
            aria-label={t('header.home', 'Home')}
            title={t('header.home', 'Back to dashboard')}
            onClick={() => setHomeMenuOpen((v) => !v)}
            css={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: 10,
              cursor: 'pointer',
              color: CREAM,
              background: homeMenuOpen ? 'rgba(180,138,90,.18)' : 'transparent',
              border: '1px solid rgba(180,138,90,.35)',
              transition: 'background .15s ease',
              ':hover': { background: 'rgba(180,138,90,.18)' },
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V21h14V9.5" />
            </svg>
          </button>
          {homeMenuOpen && (
            <>
              {/* click-away backdrop */}
              <div css={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setHomeMenuOpen(false)} />
              <div
                css={{
                  position: 'absolute',
                  top: 46,
                  left: 0,
                  zIndex: 41,
                  width: 260,
                  background: '#FBF9F5',
                  borderRadius: 12,
                  border: '1px solid rgba(180,138,90,.25)',
                  boxShadow: '0 12px 32px rgba(11,27,58,.22)',
                  padding: 14,
                  fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
                }}
              >
                <div css={{ fontSize: 14, fontWeight: 600, color: '#0B1B3A', marginBottom: 4 }}>
                  {t('header.leaveTitle', 'Go to dashboard?')}
                </div>
                <div css={{ fontSize: 12.5, color: '#6B6559', marginBottom: 12, lineHeight: 1.4 }}>
                  {t('header.leaveBody', 'Save your changes to this template before leaving?')}
                </div>
                <button
                  onClick={handleHomeSave}
                  css={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    background: BRONZE,
                    color: '#0B1B3A',
                    fontWeight: 600,
                    fontSize: 13.5,
                    marginBottom: 8,
                    ':hover': { background: '#c49968' },
                  }}
                >
                  {t('header.saveAndLeave', 'Save & go to dashboard')}
                </button>
                <button
                  onClick={handleHomeDiscard}
                  css={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: 'transparent',
                    color: '#8A3A2E',
                    border: '1px solid rgba(138,58,46,.35)',
                    fontWeight: 600,
                    fontSize: 13.5,
                    marginBottom: 8,
                    ':hover': { background: 'rgba(138,58,46,.08)' },
                  }}
                >
                  {t('header.leaveNoSave', "Leave without saving")}
                </button>
                <button
                  onClick={() => setHomeMenuOpen(false)}
                  css={{
                    width: '100%',
                    padding: '7px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: 'transparent',
                    color: '#6B6559',
                    border: 'none',
                    fontSize: 13,
                    ':hover': { color: '#0B1B3A' },
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Brand */}
      {!isMobile && (
        <div
          css={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            userSelect: 'none',
          }}
        >
          <span
            css={{
              width: 14,
              height: 14,
              transform: 'rotate(45deg)',
              border: `2px solid ${BRONZE}`,
              borderRadius: 2,
              display: 'inline-block',
              position: 'relative',
              '::after': {
                content: '""',
                position: 'absolute',
                inset: 3,
                background: BRONZE,
                borderRadius: 1,
              },
            }}
          />
          <span
            css={{
              fontFamily: 'var(--font-serif, "Cormorant Garamond", Georgia, serif)',
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '.01em',
              color: CREAM,
              lineHeight: 1,
            }}
          >
            CertiFlow
          </span>
        </div>
      )}

      {/* File menu */}
      <div css={{ marginRight: 'auto' }}>
        <div css={{ margin: isMobile ? '0 12px 0 0' : '0 20px' }}>
          <HeaderFileMenu designName={name} onRemove={onRemove} />
        </div>
      </div>

      {/* Name + status + actions */}
      <div css={{ display: 'flex', alignItems: 'center' }}>
        <div css={{ display: 'flex', alignItems: 'center', columnGap: 12 }}>
          <EditInlineInput
            text={name}
            placeholder={t('header.untitledDesign', 'Untitled design')}
            autoRow={false}
            styles={{
              placeholderColor: CREAM_MUTED,
            }}
            onSetText={(newText) => {
              setName(newText);
              if (name !== newText) {
                onChanges(newText);
                actions.setName(newText);
              }
            }}
            handleStyle={(isFocus) => {
              return {
                color: CREAM,
                borderRadius: 8,
                padding: 8,
                minHeight: 18,
                minWidth: 18,
                fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
                border: `1px solid ${isFocus ? 'rgba(180,138,90,.7)' : 'transparent'}`,
                ':hover': {
                  border: '1px solid rgba(180,138,90,.5)',
                },
              };
            }}
            inputCss={{
              borderBottomColor: 'transparent',
              backgroundColor: 'transparent',
            }}
          />
          <div css={{ color: CREAM_MUTED, display: 'flex', alignItems: 'center' }} title={saving ? 'Saving…' : 'All changes saved'}>
            {saving ? <SyncingIcon /> : <SyncedIcon />}
          </div>
        </div>

        <div css={{ margin: '0 16px' }}>
          <SettingDivider background="rgba(237,231,220,.18)" />
        </div>

        <div css={{ display: 'flex', columnGap: 12, alignItems: 'center' }}>
          <EditorButton
            onClick={actions.history.undo}
            disabled={!query.history.canUndo()}
            styles={{
              disabledColor: 'rgba(237,231,220,.35)',
              color: CREAM,
            }}
            tooltip="Undo"
          >
            <BackIcon />
          </EditorButton>
          <EditorButton
            onClick={actions.history.redo}
            disabled={!query.history.canRedo()}
            styles={{
              disabledColor: 'rgba(237,231,220,.35)',
              color: CREAM,
            }}
            tooltip="Redo"
          >
            <NextIcon />
          </EditorButton>

          {onSave && (
            <button
              onClick={handleSave}
              css={{
                marginLeft: 6,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: BRONZE,
                color: '#0B1B3A',
                fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '.02em',
                padding: '9px 22px',
                borderRadius: 999,
                cursor: 'pointer',
                border: '1px solid rgba(180,138,90,.9)',
                transition: 'background .15s ease, transform .15s ease',
                ':hover': {
                  background: '#c49968',
                },
                ':active': {
                  transform: 'translateY(1px)',
                },
              }}
            >
              {t('header.save', 'Save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default forwardRef(HeaderLayout);
