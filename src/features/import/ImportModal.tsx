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

  const [customPath, setCustomPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStartImport = async () => {
    onOpenChange(false);
    await importPipeline.importFolder({
      createPlaylistPerFolder,
      minTrackDurationS: skipShortFiles ? 30 : 0,
    });
  };

  const handleCustomPathImport = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!customPath.trim()) return;
    setIsSubmitting(true);
    try {
      const success = await importPipeline.importFolderPath(customPath, {
        createPlaylistPerFolder,
        minTrackDurationS: skipShortFiles ? 30 : 0,
      });
      if (success) {
        setCustomPath('');
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
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
            maxWidth: 520,
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

          <Dialog.Description style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)', marginBottom: '20px', lineHeight: 1.5 }}>
            Choose a folder or type a custom directory path. Sonara will recursively scan and index your music files locally.
          </Dialog.Description>

          {/* Custom Path Input */}
          <form onSubmit={handleCustomPathImport} style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
              Enter Custom Folder Path
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="e.g. D:\Music or C:\Users\Username\Music"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-thumb)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <Button
                type="submit"
                variant="primary"
                disabled={!customPath.trim() || isSubmitting}
                style={{ whiteSpace: 'nowrap' }}
              >
                {isSubmitting ? 'Adding...' : 'Add Path'}
              </Button>
            </div>
          </form>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              margin: '16px 0',
              color: 'var(--text-sub)',
              fontSize: '12px',
            }}
          >
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)' }} />
            <span>OR BROWSE SYSTEM</span>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)' }} />
          </div>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px' }}>
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
            <Button variant="secondary" onClick={handleStartImport}>
              Browse Folders...
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
