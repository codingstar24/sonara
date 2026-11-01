import { type FC, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/Button';
import { Folder, X } from '@phosphor-icons/react';
import { importPipeline } from './importPipeline';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ImportModal: FC<ImportModalProps> = ({ open, onOpenChange }) => {
  const [createPlaylistPerFolder, setCreatePlaylistPerFolder] = useState(true);
  const [skipShortFiles, setSkipShortFiles] = useState(false);

  const handleStartImport = async () => {
    onOpenChange(false);
    await importPipeline.importFolder({
      createPlaylistPerFolder,
      minTrackDurationS: skipShortFiles ? 30 : 0,
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            animation: 'fadeIn 150ms ease-out',
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'var(--bg-elevated)',
            padding: '32px',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-dropdown)',
            width: '90vw',
            maxWidth: 480,
            zIndex: 1001,
            color: 'var(--text)',
            outline: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'var(--bg-card-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                }}
              >
                <Folder size={24} weight="fill" />
              </div>
              <Dialog.Title style={{ fontSize: 'var(--text-h2)', fontWeight: 'var(--font-heading)' }}>
                Add Music Folder
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-sub)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)', marginBottom: '24px', lineHeight: 1.5 }}>
            Choose a folder on your computer. Sonara will recursively scan and index your music files locally. No files will be moved or modified.
          </Dialog.Description>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: 'var(--text-body)' }}>
              <input
                type="checkbox"
                checked={createPlaylistPerFolder}
                onChange={(e) => setCreatePlaylistPerFolder(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
              />
              <span>Create a playlist from each folder</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: 'var(--text-body)' }}>
              <input
                type="checkbox"
                checked={skipShortFiles}
                onChange={(e) => setSkipShortFiles(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
              />
              <span>Skip files shorter than 30 seconds (voice notes, ringtones)</span>
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleStartImport}>
              Select Folder
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
