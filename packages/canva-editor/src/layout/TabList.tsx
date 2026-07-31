import React, { FC, ReactNode } from 'react';

interface SidebarTabProps {
    tabs: {
        name: string;
        displayName: string;
        icon: ReactNode;
    }[];
    active: string | null;
    onChange: (e: React.MouseEvent, tab: string) => void;
}

// CertiFlow luxury palette for the editor rail.
const NAVY = '#0B1B3A';
const CREAM = '#EDE7DC';
const CREAM_MUTED = 'rgba(237,231,220,.6)';
const BRONZE = '#B48A5A';

const SidebarTab: FC<SidebarTabProps> = ({ tabs, active, onChange }) => {
    const activeIdx = tabs.findIndex((tab) => tab.name === active);
    return (
        <div
            css={{
                color: CREAM_MUTED,
                background: 'linear-gradient(180deg, #0B1B3A 0%, #0C1E42 100%)',
                borderRadius: 12,
                marginRight: 1,
                '@media (max-width: 900px)': {
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: NAVY,
                    display: 'flex',
                    justifyContent: 'center',
                    borderTop: '1px solid rgba(180,138,90,.3)',
                    borderRadius: 0,
                    zIndex: 10,
                },
            }}
        >
            <div
                css={{
                    overflow: 'hidden',
                    position: 'relative',
                    padding: '6px 0',
                    '@media (max-width: 900px)': {
                        display: 'flex',
                        padding: 0,
                    },
                }}
            >
                {tabs.map((tab, idx) => {
                    const isActive = idx === activeIdx;
                    return (
                        <button
                            key={idx}
                            css={{
                                color: isActive ? BRONZE : CREAM_MUTED,
                                borderRadius: 10,
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 4,
                                padding: '0 2px',
                                height: 62,
                                width: 64,
                                margin: '3px 6px',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
                                background: isActive ? 'rgba(180,138,90,.14)' : 'transparent',
                                transition: 'color .15s ease, background .15s ease',
                                ':hover': {
                                    color: isActive ? BRONZE : CREAM,
                                    background: isActive ? 'rgba(180,138,90,.18)' : 'rgba(237,231,220,.08)',
                                },
                            }}
                            onClick={(e) => onChange(e, tab.name)}
                        >
                            {/* Bronze active accent bar */}
                            <span
                                css={{
                                    position: 'absolute',
                                    left: 0,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 3,
                                    height: isActive ? 28 : 0,
                                    borderRadius: 3,
                                    background: BRONZE,
                                    transition: 'height .18s ease',
                                    '@media (max-width: 900px)': {
                                        display: 'none',
                                    },
                                }}
                            />
                            <div css={{ fontSize: 23, height: 26, display: 'flex', alignItems: 'center' }}>
                                {tab.icon}
                            </div>
                            <span
                                css={{
                                    fontSize: 10,
                                    lineHeight: 1.4,
                                    fontWeight: 600,
                                    letterSpacing: '.02em',
                                }}
                            >
                                {tab.displayName}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default SidebarTab;
