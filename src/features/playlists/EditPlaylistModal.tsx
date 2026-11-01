import { type FC, useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Image as ImageIcon } from '@phosphor-icons/react';
import { usePlaylistStore } from './playlistStore';
import { cropImageToSquareBlob } from './playlistCover';
import { safeBlobUrl } from '@/lib/blobUrl';
import type { Playlist } from '@/db/types';

interface EditPlaylistModalProps {
  playlist: Playlist;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditPlaylistModal: FC<EditPlaylistModalProps> = ({
  playlist,
  open,
  onOpenChange,
}) => {
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description || '');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [newCoverBlob, setNewCoverBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const squareBlob = await cropImageToSquareBlob(file, 512);
      setNewCoverBlob(squareBlob);
      const url = URL.createObjectURL(squareBlob);
      setCoverPreview(url);
    } catch (err) {
      console.error('Failed to process image:', err);
    }
  };

  const handleSave = async () => {
    if (name.trim()) {
      await usePlaylistStore.getState().renamePlaylist(playlist.id, name.trim());
    }
    await usePlaylistStore.getState().updateDescription(playlist.id, description.trim());
    if (newCoverBlob) {
      await usePlaylistStore.getState().setCustomCover(playlist.id, newCoverBlob);
    }
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-modal)',
            padding: '24px',
            width: '90vw',
            maxWidth: '520px',
            boxShadow: 'var(--shadow-popover)',
            zIndex: 10001,
            color: 'var(--text)',
            outline: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
            }}
          >
            <Dialog.Title
              style={{
                fontSize: 'var(--text-h2)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              Edit details
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="icon-btn"
                aria-label="Close"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-sub)',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
            {/* Cover picker */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 160,
                height: 160,
                borderRadius: 'var(--radius-card)',
                backgroundColor: 'var(--bg-card)',
                position: 'relative',
                cursor: 'pointer',
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : safeBlobUrl(playlist.customCover) ? (
                <img
                  src={safeBlobUrl(playlist.customCover)!}
                  alt="Cover"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--text-sub)',
                  }}
                >
                  <ImageIcon size={32} />
                  <span style={{ fontSize: '11px', textAlign: 'center' }}>Choose photo</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            {/* Inputs */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-sub)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text)',
                    fontSize: 'var(--text-body)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-sub)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Add an optional description"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text)',
                    fontSize: 'var(--text-caption)',
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Dialog.Close asChild>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  fontWeight: 600,
                  fontSize: 'var(--text-body)',
                  cursor: 'pointer',
                  padding: '8px 16px',
                }}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              style={{
                backgroundColor: 'var(--text)',
                color: 'var(--bg-base)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                padding: '10px 24px',
                fontWeight: 700,
                fontSize: 'var(--text-body)',
                cursor: 'pointer',
              }}
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
