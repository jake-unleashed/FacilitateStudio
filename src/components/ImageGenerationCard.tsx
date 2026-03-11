import { useRef, useState } from 'react';
import { ImagePlus, Sparkles } from 'lucide-react';
import { logger } from '../utils/logger';
import { usePopup } from '../contexts/PopupContext';
import { getErrorMessage } from '../utils/errors';

interface ImageGenerationCardProps {
  onGenerate: (imageFile: File) => Promise<void> | void;
  disabled?: boolean;
}

export function ImageGenerationCard({ onGenerate, disabled = false }: ImageGenerationCardProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showPopup } = usePopup();

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setSelectedImageName(file.name);
    setIsSubmitting(true);
    try {
      await onGenerate(file);
    } catch (error) {
      logger.error('[ImageGenerationCard] Failed to start image generation:', error);
      showPopup({
        type: 'error',
        title: 'Image generation failed',
        message: getErrorMessage(error, 'We could not start model generation from that image.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled || isSubmitting}
        onClick={() => fileInputRef.current?.click()}
        className="group flex w-full items-start gap-4 rounded-[20px] border border-white/40 bg-white/60 p-5 text-left shadow-sm transition-all duration-300 hover:bg-white/80 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-white/60 bg-white/70 text-blue-600 shadow-sm">
          {isSubmitting ? <Sparkles size={22} className="animate-pulse" /> : <ImagePlus size={22} />}
        </span>
        <span className="flex-1">
          <span className="text-sm font-semibold text-slate-800">Create from Image</span>
          <span className="mt-1 block text-xs font-medium text-slate-500">
            Upload one image and generate a 3D model with AI
          </span>
          {selectedImageName ? (
            <span className="mt-2 block truncate text-xs font-semibold text-slate-700">
              Selected: {selectedImageName}
            </span>
          ) : null}
        </span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          void handleFile(file);
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
}
