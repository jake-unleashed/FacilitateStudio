import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  mono?: boolean;
}

export const Input: React.FC<InputProps> = ({ label, mono, className = '', ...props }) => {
  const generatedId = useId();
  const inputId = props.id ?? generatedId;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label
          htmlFor={inputId}
          className="pl-1 text-xs font-bold uppercase tracking-widest text-slate-500"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full rounded-[20px] border border-transparent bg-slate-100/50 
          px-4 py-2.5 text-sm
          text-slate-800
          shadow-inner backdrop-blur-sm transition-all
          duration-200
          placeholder:text-slate-400
          hover:bg-slate-100/80 focus:border-blue-400/50 focus:bg-white
          focus:outline-none focus:ring-4
          focus:ring-blue-500/10
          ${mono ? 'font-mono' : 'font-sans'}
          ${className}
        `}
        {...props}
      />
    </div>
  );
};
