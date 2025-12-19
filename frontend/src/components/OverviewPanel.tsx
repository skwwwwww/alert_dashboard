import { useState } from 'react';
import { clsx } from 'clsx';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, CheckCircle, XCircle } from 'lucide-react';
import { IssueList } from './IssueList';
import { PeriodSelector } from './PeriodSelector';
import { TrendModal } from './TrendModal';

interface MetricStat {
    current: number;
    previous: number;
    change: number;
    trend: "up" | "down" | "neutral";
}

interface ComponentStats {
    component: string;
    period: string;
    total_alerts: MetricStat;
    fake_alarm_rate_stat?: MetricStat;
    handling_rate_stat?: MetricStat;
    daily_trend: any[];
}

interface OverviewPanelProps {
    stats: ComponentStats;
    days: number;
    onDaysChange: (days: number) => void;
    step: string;
    onStepChange: (step: string) => void;
    env: string;
    componentName: string;
    category?: string;
}

const MiniMetricCard = ({
    label,
    value,
    change,
    icon,
    active = false,
    onClick,
    isPercent = false
}: {
    label: string;
    value: number;
    change: number;
    trend?: string;
    icon: any;
    active?: boolean;
    onClick?: () => void;
    isPercent?: boolean;
}) => {
    return (
        <div
            onClick={onClick}
            className={clsx(
                "flex flex-col p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden",
                active
                    ? "bg-blue-50/50 border-blue-200 shadow-sm ring-1 ring-blue-100"
                    : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-200"
            )}
        >
            <div className="flex items-center gap-2 mb-2">
                <div className={clsx("p-1.5 rounded-lg", active ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500")}>
                    {icon}
                </div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
            </div>

            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">
                    {isPercent ? `${value.toFixed(1)}%` : value.toLocaleString()}
                </span>
            </div>

            <div className="flex items-center gap-1 mt-1">
                <span className={clsx("text-xs font-medium", change > 0 ? "text-red-500" : "text-green-500")}>
                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                </span>
                <span className="text-[10px] text-gray-400">vs prev</span>
            </div>
        </div>
    );
};

export const OverviewPanel = ({ stats, days, onDaysChange, step, onStepChange, env, componentName, category }: OverviewPanelProps) => {
    // We can use this to toggle what the chart shows if we had data
    const [activeMetric, setActiveMetric] = useState<'total' | 'fake' | 'handled'>('total');

    // For detailed view
    const [detailsOpen, setDetailsOpen] = useState(false);

    const getMetricTitle = () => {
        switch (activeMetric) {
            case 'fake': return 'False Positive Analysis';
            case 'handled': return 'Handled Issues Analysis';
            default: return 'Total Alerts Analysis';
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50/50">
                <div>
                    <h3 className="text-base font-semibold text-gray-900">Alert Overview</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Key performance indicators and trends</p>
                </div>
                <div className="flex items-center gap-3">
                    <PeriodSelector
                        options={[
                            { id: 'day', label: 'Day' },
                            { id: 'week', label: 'Week' },
                            { id: 'month', label: 'Month' }
                        ]}
                        selected={step}
                        onChange={(id) => onStepChange(id as string)}
                        size="sm"
                    />
                    <PeriodSelector
                        options={[
                            { id: 7, label: 'Last 7 Days' },
                            { id: 30, label: 'Last 30 Days' },
                            { id: 90, label: 'Last 90 Days' }
                        ]}
                        selected={days}
                        onChange={(id) => onDaysChange(id as number)}
                        size="sm"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 border-b border-gray-100">
                <MiniMetricCard
                    label="Total Alerts"
                    value={stats.total_alerts.current}
                    change={stats.total_alerts.change}
                    trend={stats.total_alerts.trend}
                    icon={<Activity className="w-4 h-4" />}
                    active={activeMetric === 'total'}
                    onClick={() => { setActiveMetric('total'); setDetailsOpen(true); }}
                />
                <MiniMetricCard
                    label="Avg Daily"
                    value={Math.round(stats.total_alerts.current / days)}
                    change={stats.total_alerts.change} // Approx using same change
                    trend={stats.total_alerts.trend}
                    icon={<Activity className="w-4 h-4" />}
                />
                <MiniMetricCard
                    label="Handling Rate"
                    value={stats.handling_rate_stat?.current || 0}
                    change={stats.handling_rate_stat?.change || 0}
                    trend={stats.handling_rate_stat?.trend || 'neutral'}
                    icon={<CheckCircle className="w-4 h-4" />}
                    active={activeMetric === 'handled'}
                    onClick={() => { setActiveMetric('handled'); setDetailsOpen(true); }}
                    isPercent
                />
                <MiniMetricCard
                    label="False Positive Rate"
                    value={stats.fake_alarm_rate_stat?.current || 0}
                    change={stats.fake_alarm_rate_stat?.change || 0}
                    trend={stats.fake_alarm_rate_stat?.trend || 'neutral'}
                    icon={<XCircle className="w-4 h-4" />}
                    active={activeMetric === 'fake'}
                    onClick={() => { setActiveMetric('fake'); setDetailsOpen(true); }}
                    isPercent
                />
            </div>

            {/* Chart Area */}
            <div className="p-6 relative">
                <div className="h-[300px] w-full">
                    {/* Reusing simple chart logic here for visual consistency with the panel */}
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.daily_trend || []}>
                            <defs>
                                <linearGradient id="colorTrendPanel" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#9ca3af"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(s) => s.slice(5)}
                                dy={10}
                            />
                            <YAxis
                                stroke="#9ca3af"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                dx={-10}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ color: '#1f2937', fontSize: '12px' }}
                                labelStyle={{ color: '#6b7280', fontSize: '11px', marginBottom: '4px' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="total_alerts"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fill="url(#colorTrendPanel)"
                                activeDot={{ r: 4, strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* View Details Overlay Button */}
                <div className="absolute top-6 right-6">
                    <button
                        onClick={() => setDetailsOpen(true)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-white/80 hover:bg-white backdrop-blur-sm px-3 py-1.5 rounded-full border border-blue-100 shadow-sm transition-all"
                    >
                        View Detailed Analysis
                    </button>
                </div>
            </div>

            <TrendModal
                isOpen={detailsOpen}
                onClose={() => setDetailsOpen(false)}
            >
                {/* Use IssueList for all OverviewPanel drill-downs as requested */}
                <IssueList
                    title={`${getMetricTitle()} - ${componentName}`}
                    component={componentName}
                    env={env}
                    days={days}
                    metricType={activeMetric}
                    category={category}
                />
            </TrendModal>
        </div>
    );
};
