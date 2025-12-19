import { type ReactNode } from 'react';
import { clsx } from 'clsx';

interface ToolbarOption {
    id: string;
    label: string;
}

interface PanelProps {
    title: string;
    children: ReactNode;
    toolbar?: {
        options: ToolbarOption[];
        selected: string;
        onChange: (id: string) => void;
    };
    additionalToolbar?: ReactNode;  // For period selectors or other controls
    headerAction?: ReactNode;
    className?: string;
}

export const Panel = ({ title, children, toolbar, additionalToolbar, headerAction, className }: PanelProps) => {
    return (
        <div className={clsx("rounded-xl bg-white border border-border shadow-sm overflow-hidden", className)}>
            <div className="px-6 py-4 border-b border-border bg-gray-50/50">
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                    <div className="flex items-center gap-3">
                        {additionalToolbar}
                        {toolbar && (
                            <div className="flex items-center bg-white border border-border rounded-lg overflow-hidden">
                                {toolbar.options.map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => toolbar.onChange(option.id)}
                                        className={clsx(
                                            "px-3 py-1 text-xs font-medium border-r border-border last:border-r-0 transition-colors",
                                            toolbar.selected === option.id
                                                ? "bg-blue-50 text-blue-600"
                                                : "text-gray-600 hover:bg-gray-50"
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {headerAction}
                    </div>
                </div>
            </div>
            <div className="p-6">
                {children}
            </div>
        </div>
    );
};

