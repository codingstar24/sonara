import { type FC, type ReactNode } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  delayDuration?: number;
}

export const TooltipProvider = RadixTooltip.Provider;

export const Tooltip: FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 200,
}) => {
  if (!content) return <>{children}</>;

  return (
    <RadixTooltip.Root delayDuration={delayDuration}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={8}
          style={{
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text)',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-caption)',
            fontWeight: 500,
            boxShadow: 'var(--shadow-dropdown)',
            zIndex: 1000,
            pointerEvents: 'none',
            animation: 'fadeIn 120ms ease-out',
            maxWidth: 240,
            textAlign: 'center',
          }}
        >
          {content}
          <RadixTooltip.Arrow style={{ fill: 'var(--bg-elevated)' }} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
};
