import { ImagePlus, MessageCircle, Plus, Upload } from 'lucide-react';

interface ModelAddEntryCardProps {
  title: string;
  subtitle: string;
  onClick: () => void;
}

export function ModelAddEntryCard({
  title,
  subtitle,
  onClick,
}: ModelAddEntryCardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-4 rounded-[20px] border border-white/40 bg-white/60 p-5 text-left shadow-sm transition-all duration-300 hover:bg-white/80 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/10"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-blue-100/80 bg-blue-50/80 text-blue-600 shadow-sm transition-transform duration-300 group-hover:scale-105">
        <Plus size={24} />
      </span>
      <span className="flex-1">
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        <span className="mt-1 block text-xs font-medium text-slate-500">{subtitle}</span>
      </span>
    </button>
  );
}

interface ModelSourceOptionsProps {
  onUploadClick: () => void;
  onGenerateFromImageClick: () => void;
  onRequestModelClick: () => void;
}

export function ModelSourceOptions({
  onUploadClick,
  onGenerateFromImageClick,
  onRequestModelClick,
}: ModelSourceOptionsProps): JSX.Element {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onUploadClick}
        className="group flex w-full items-start gap-3 rounded-[20px] border border-white/40 bg-white/60 p-4 text-left shadow-sm transition-all duration-300 hover:bg-white/80 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-blue-100/80 bg-blue-50/80 text-blue-600">
          <Upload size={18} />
        </span>
        <span className="flex-1">
          <span className="text-sm font-semibold text-slate-800">Upload 3D Model</span>
          <span className="mt-0.5 block text-xs font-medium text-slate-500">Import a GLB, FBX, or OBJ</span>
        </span>
      </button>

      <button
        type="button"
        onClick={onGenerateFromImageClick}
        className="group flex w-full items-start gap-3 rounded-[20px] border border-white/40 bg-white/60 p-4 text-left shadow-sm transition-all duration-300 hover:bg-white/80 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-indigo-100/80 bg-indigo-50/80 text-indigo-600">
          <ImagePlus size={18} />
        </span>
        <span className="flex-1">
          <span className="text-sm font-semibold text-slate-800">Create from Image</span>
          <span className="mt-0.5 block text-xs font-medium text-slate-500">
            Generate a 3D model using AI
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={onRequestModelClick}
        className="group flex w-full items-start gap-3 rounded-[20px] border border-white/40 bg-white/60 p-4 text-left shadow-sm transition-all duration-300 hover:bg-white/80 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-slate-200/80 bg-slate-100/80 text-slate-600">
          <MessageCircle size={18} />
        </span>
        <span className="flex-1">
          <span className="text-sm font-semibold text-slate-800">Request a 3D Model</span>
          <span className="mt-0.5 block text-xs font-medium text-slate-500">
            We&apos;ll help create one for you
          </span>
        </span>
      </button>
    </div>
  );
}
