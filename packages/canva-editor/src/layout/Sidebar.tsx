import SidebarTab from './TabList';
import TextContent from './sidebar/TextContent';
import ShapeContent from './sidebar/ShapeContent';
import ToolsContent from './sidebar/ToolsContent';
import ImageContent from './sidebar/ImageContent';
import TemplateContent from './sidebar/TemplateContent';
import FrameContent from './sidebar/FrameContent';
import { useEditor } from 'canva-editor/hooks';

// Icons
import LayoutIcon from 'canva-editor/icons/LayoutIcon';
import TextIcon from 'canva-editor/icons/TextIcon';
import ElementsIcon from 'canva-editor/icons/ElementsIcon';
import ImageIcon from 'canva-editor/icons/ImageIcon';
import Notes from 'canva-editor/utils/settings/sidebar/Notes';
import FrameIcon from 'canva-editor/icons/FrameIcon';
import useMobileDetect from 'canva-editor/hooks/useMobileDetect';
import BottomSheet from 'canva-editor/components/bottom-sheet/BottomSheet';
import PlusIcon from 'canva-editor/icons/PlusIcon';
import GridViewIcon from 'canva-editor/icons/GridViewIcon';
import styled from '@emotion/styled';
import { FC } from 'react';
import { useTranslate } from 'canva-editor/contexts/TranslationContext';

const FABButton = styled('button')`
  position: fixed;
  bottom: 80px;
  background-color: #fff;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  color: #0d1216;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  vertical-align: middle;
`;

const Sidebar: FC = () => {
  const { actions, state } = useEditor();
  const isMobile = useMobileDetect();
  const t = useTranslate();
  const tabs = [
    {
      name: 'Template',
      displayName: t('sidebar.template', 'Template'),
      icon: <LayoutIcon />,
    },
    {
      name: 'Text',
      displayName: t('sidebar.text', 'Text'),
      icon: <TextIcon />,
    },
    {
      name: 'Image',
      displayName: t('sidebar.image', 'Image'),
      icon: <ImageIcon />,
    },
    {
      name: 'Shape',
      displayName: t('sidebar.shape', 'Shape'),
      icon: <ElementsIcon />,
    },
    {
      name: 'Frame',
      displayName: t('sidebar.frame', 'Frame'),
      icon: <FrameIcon />,
    },
    {
      name: 'Tools',
      displayName: t('sidebar.tools', 'Tools'),
      icon: (
        <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a3 3 0 0 0 3.9 3.9l2.4 2.4a2 2 0 0 1-2.8 2.8l-2.4-2.4a3 3 0 0 0-3.9-3.9z" />
          <path d="M6 13l-2.5 2.5a2.1 2.1 0 0 0 3 3L9 16" />
          <path d="M14.5 9.5L4 20" />
        </svg>
      ),
    },
  ];

  const getSidebarComponent = (tabName: string) => {
    switch (tabName) {
      case 'Template':
        return (
          <TemplateContent
            onClose={() => {
              actions.setSidebarTab();
              actions.setSidebar();
            }}
          />
        );
      case 'Text':
        return (
          <TextContent
            onClose={() => {
              actions.setSidebarTab();
              actions.setSidebar();
            }}
          />
        );
      case 'Frame':
        return (
          <FrameContent
            onClose={() => {
              actions.setSidebarTab();
              actions.setSidebar();
            }}
          />
        );
      case 'Image':
        return (
          <ImageContent
            onClose={() => {
              actions.setSidebarTab();
              actions.setSidebar();
            }}
          />
        );
      case 'Shape':
        return (
          <ShapeContent
            onClose={() => {
              actions.setSidebarTab();
              actions.setSidebar();
            }}
          />
        );
      case 'Tools':
        return (
          <ToolsContent
            onClose={() => {
              actions.setSidebarTab();
              actions.setSidebar();
            }}
          />
        );
      case 'Notes':
        return <Notes placeholder={t('sidebar.notesPlaceholder', 'Notes will be displayed in Presenter View')} />;
    }
  };

  return (
    <div
      css={{
        display: 'flex',
        position: 'relative',
        borderRadius: 12,
      }}
    >
      {isMobile && (
        <>
          <BottomSheet
            isOpen={!!state.sideBarTab}
            onClose={() => {
              actions.setSidebarTab();
              actions.setSidebar();
            }}
          >
            {state.sideBarTab && getSidebarComponent(state.sideBarTab)}
          </BottomSheet>
          <div id="bottom_sheet" />
        </>
      )}
      <div
        css={{
          display: 'flex',
        }}
      >
        <SidebarTab
          tabs={tabs}
          active={state.sideBarTab}
          onChange={(_, tab) => {
            actions.setSidebar();
            actions.setSidebarTab(tab);
          }}
        />
        {!isMobile && (
          <>
            {state.sideBarTab && (
              <div
                css={{
                  backgroundColor: '#FBF9F5',
                  borderRadius: 12,
                  border: '1px solid rgba(180,138,90,.18)',
                  width: 360,
                  '@media (max-width: 900px)': {
                    width: '100%',
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    top: 0,
                    background: '#FBF9F5',
                  },
                }}
              >
                {getSidebarComponent(state.sideBarTab)}
              </div>
            )}
          </>
        )}
      </div>
      <div
        css={{
          width: state.sidebar ? 360 : 0,
          overflow: 'hidden',
          borderRadius: 12,
          height: '100%',
          pointerEvents: 'none',
          zIndex: isMobile ? 1000 : 30,
          ...(state.sideBarTab
            ? {
                position: 'absolute',
                top: 0,
                left: 77,
              }
            : {}),
        }}
        id={'settings'}
      />
      {isMobile && (
        <div>
          <FABButton css={{ left: 10 }} onClick={() => actions.addPage()}>
            <PlusIcon />
          </FABButton>
          <FABButton
            css={{ right: 10 }}
            onClick={() => actions.togglePageSettings()}
          >
            <GridViewIcon />
          </FABButton>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
