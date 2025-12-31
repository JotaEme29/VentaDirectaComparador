// components/ui/Button.tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
}

export const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    ...props
}: ButtonProps) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none rounded-xl';

    const variants = {
        primary: 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/30 focus:ring-blue-500 border-none',
        secondary: 'bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-500',
        outline: 'border-2 border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-300 focus:ring-slate-500',
        ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-500'
    };

    const sizes = {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg'
    };

    const widthStyle = fullWidth ? 'w-full' : '';

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyle} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

// components/ui/Input.tsx
export const Input = ({ label, error, ...props }: { label?: string, error?: string } & React.InputHTMLAttributes<HTMLInputElement>) => {
    return (
        <div className="w-full space-y-1.5">
            {label && <label className="text-sm font-bold text-slate-700 ml-1">{label}</label>}
            <input
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 text-slate-700"
                {...props}
            />
            {error && <span className="text-xs text-red-500 ml-1">{error}</span>}
        </div>
    );
};

// components/ui/Card.tsx
export const Card = ({ children, className = '', hover = true, onClick }: { children: React.ReactNode, className?: string, hover?: boolean, onClick?: () => void }) => {
    return (
        <div
            onClick={onClick}
            className={`bg-white border border-slate-100 rounded-3xl p-6 shadow-sm ${hover ? 'hover:shadow-xl hover:-translate-y-1 transition-all duration-300' : ''} ${onClick ? 'cursor-pointer' : ''} ${className}`}
        >
            {children}
        </div>
    );
};

// components/ui/Badge.tsx
export const Badge = ({ children, variant = 'blue' }: { children: React.ReactNode, variant?: 'blue' | 'green' | 'amber' | 'slate' | 'premium' }) => {
    const variants = {
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        slate: 'bg-slate-50 text-slate-600 border-slate-200',
        premium: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-none'
    };

    return (
        <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase letter-spacing-wide border ${variants[variant]}`}>
            {children}
        </span>
    );
};
