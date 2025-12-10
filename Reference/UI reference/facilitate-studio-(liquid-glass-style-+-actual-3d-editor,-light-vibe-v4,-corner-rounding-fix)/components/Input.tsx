import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  mono?: boolean;
}

export const Input: React.FC<InputProps> = ({ label, mono, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-4 py-2.5 text-sm text-slate-800 
          bg-slate-100/50 hover:bg-slate-100/80 focus:bg-white
          backdrop-blur-sm
          border border-transparent focus:border-blue-400/50
          rounded-[20px]
          placeholder:text-slate-400
          focus:outline-none focus:ring-4 focus:ring-blue-500/10
          transition-all duration-200
          shadow-inner
          ${mono ? 'font-mono text-xs' : 'font-sans'}
          ${className}
        `}
        {...props}
      />
    </div>
  );
};