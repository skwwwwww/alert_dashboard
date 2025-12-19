import { type ReactNode } from 'react';
import { clsx } from 'clsx';

interface MetricCardProps {
    label: string;
    value: string | number;
    trend?: {
        value: number;
        suffix?: string;
    };
    className?: string;
    icon?: ReactNode;
    onClick?: () => void;
}

export const MetricCard = ({ label, value, trend, className, icon, onClick }: MetricCardProps) => {
    return (
        <div
            className={clsx(
                "bg-white border border-gray-200 rounded-lg px-4 py-3 transition-all",
                onClick && "cursor-pointer hover:shadow-lg hover:border-blue-300 hover:scale-[1.02]",
                className
            )}
            onClick={onClick}
        >
            <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
                {icon && <div className="text-gray-400">{icon}</div>}
            </div>
            <div className="text-2xl font-bold text-gray-900">
                {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            {trend && (
                <div className={clsx(
                    "text-xs font-medium mt-1",
                    trend.value > 0 ? "text-red-600" : trend.value < 0 ? "text-green-600" : "text-gray-500"
                )}>
                    {trend.value > 0 && '+'}{trend.value.toFixed(1)}{trend.suffix || '%'}
                </div>
            )}
        </div>
    );
};
