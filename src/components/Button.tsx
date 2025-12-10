import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'guidance' | 'ghost' | 'icon' | 'glass';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold transition-all duration-300 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-95';

  const variants = {
    primary:
      'bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-500 hover:shadow-blue-500/40 border border-blue-400/20',
    secondary:
      'bg-white/60 backdrop-blur-md border border-white/60 text-slate-800 hover:bg-white/80 shadow-sm',
    glass:
      'bg-white/30 backdrop-blur-md border border-white/40 text-white hover:bg-white/40 shadow-glass',
    guidance: 'bg-purple-500/10 text-purple-700 border border-purple-500/20 hover:bg-purple-500/20',
    ghost: 'text-slate-600 hover:bg-black/5 hover:text-slate-900',
    icon: 'text-slate-600 hover:text-blue-600 hover:bg-blue-500/10',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 rounded-[12px]',
    md: 'text-sm px-5 py-2.5 rounded-[20px]',
    lg: 'text-base px-7 py-3.5 rounded-[20px]',
    icon: 'p-2.5 rounded-full aspect-square',
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};
