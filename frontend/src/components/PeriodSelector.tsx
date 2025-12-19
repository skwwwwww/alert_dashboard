import { clsx } from 'clsx';

interface PeriodSelectorProps {
    options: {
        id: string | number;
        label: string;
    }[];
    selected: string | number;
    onChange: (id: string | number) => void;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'pills' | 'tabs';
}

export const PeriodSelector = ({
    options,
    selected,
    onChange,
    size = 'md',
    variant = 'pills'
}: PeriodSelectorProps) => {
    const sizeClasses = {
        sm: 'text-xs px-2.5 py-1',
        md: 'text-sm px-4 py-1.5',
        lg: 'text-base px-5 py-2'
    };

    if (variant === 'tabs') {
        return (
            <div className="border-b border-border">
                <div className="flex gap-6">
                    {options.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => onChange(option.id)}
                            className={clsx(
                                "pb-3 text-sm font-medium border-b-2 transition-colors",
                                selected === option.id
                                    ? "border-blue-600 text-blue-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="inline-flex items-center bg-white border border-border rounded-lg p-0.5 shadow-sm">
            {options.map((option) => (
                <button
                    key={option.id}
                    onClick={() => onChange(option.id)}
                    className={clsx(
                        "font-medium rounded-md transition-all",
                        sizeClasses[size],
                        selected === option.id
                            ? "bg-blue-50 text-blue-600 shadow-sm"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
};
