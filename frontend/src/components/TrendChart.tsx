import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PeriodSelector } from './PeriodSelector';
import { Clock, ExternalLink, AlertCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { API_BASE_URL } from '../config/api';

interface TrendChartProps {
    title: string;
    // Filter parameters
    component?: string;
    tenantId?: string;
    clusterId?: string;
    signature?: string;
    env?: string;
    metricType?: 'total' | 'critical' | 'prod' | 'non_prod' | 'fake' | 'handled';
    // Default values
    defaultDays?: number;
    defaultStep?: string;
}

interface DailyTrend {
    date: string;
    total_alerts: number;
    critical_count: number;
}

interface Issue {
    id: string;
    title: string;
    created: string;
    priority: string;
    status: string;
    alert_signature: string;
    components: string;
    tenant_id?: string;
}

export const TrendChart = ({
    title,
    component,
    tenantId,
    clusterId,
    signature,
    env = 'all',
    metricType,
    defaultDays = 7,
    defaultStep = 'day'
}: TrendChartProps) => {
    const [days, setDays] = useState(defaultDays);
    const [step, setStep] = useState(defaultStep);

    // 1. Fetch Trend Data
    const { data: trendData, isLoading: trendLoading } = useQuery({
        queryKey: ['trend', component, tenantId, clusterId, signature, env, metricType, days, step],
        queryFn: async () => {
            // Determine env based on metricType if specified
            let queryEnv = env;
            if (metricType === 'prod') {
                queryEnv = 'prod';
            } else if (metricType === 'non_prod') {
                queryEnv = 'non_prod';
            }

            let url = `${API_BASE_URL}/dashboard?days=${days}&env=${queryEnv}&step=${step}`;

            // Add filters if provided
            if (component) url += `&component=${encodeURIComponent(component)}`;
            if (tenantId) url += `&tenant_id=${encodeURIComponent(tenantId)}`;
            if (clusterId) url += `&cluster_id=${encodeURIComponent(clusterId)}`;
            if (signature) url += `&signature=${encodeURIComponent(signature)}`;

            const res = await axios.get(url);
            return res.data.dailyTrend as DailyTrend[];
        }
    });

    // 2. Fetch Detailed Issues
    const { data: issuesData, isLoading: issuesLoading } = useQuery({
        queryKey: ['trendIssues', component, tenantId, clusterId, signature, env, metricType, days],
        queryFn: async () => {
            // Determine env based on metricType if specified
            let queryEnv = env;
            if (metricType === 'prod') {
                queryEnv = 'prod';
            } else if (metricType === 'non_prod') {
                queryEnv = 'non_prod';
            }

            let url = `${API_BASE_URL}/dashboard/issues?days=${days}&env=${queryEnv}&limit=100`;

            // Add filters if provided
            if (component) url += `&component=${encodeURIComponent(component)}`;
            if (tenantId) url += `&tenant_id=${encodeURIComponent(tenantId)}`;
            if (clusterId) url += `&cluster_id=${encodeURIComponent(clusterId)}`;
            if (signature) url += `&signature=${encodeURIComponent(signature)}`;

            // Pass metric filter
            if (metricType === 'fake' || metricType === 'handled') {
                url += `&metric_type=${metricType}`;
            }

            // If viewing critical only, could add priority filter, but API might not support it yet. 
            // For now, we list all matching the scope.

            const res = await axios.get(url);
            return res.data as Issue[];
        }
    });

    return (
        <div className="space-y-8">
            {/* Header & Controls */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <div className="flex items-center gap-3">
                    <PeriodSelector
                        options={[
                            { id: 'day', label: 'Day' },
                            { id: 'week', label: 'Week' },
                            { id: 'month', label: 'Month' }
                        ]}
                        selected={step}
                        onChange={(id) => setStep(id as string)}
                        size="sm"
                    />
                    <PeriodSelector
                        options={[
                            { id: 7, label: 'Last 7 Days' },
                            { id: 30, label: 'Last 30 Days' },
                            { id: 90, label: 'Last 90 Days' }
                        ]}
                        selected={days}
                        onChange={(id) => setDays(id as number)}
                        size="sm"
                    />
                </div>
            </div>

            {/* Chart Section */}
            {trendLoading ? (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                    Loading trend data...
                </div>
            ) : (
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData || []}>
                            <defs>
                                <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(s) => s.slice(5)}
                                dy={10}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                dx={-10}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ color: '#1e293b' }}
                            />
                            <Area
                                type="monotone"
                                dataKey={metricType === 'critical' ? 'critical_count' : 'total_alerts'}
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fill="url(#colorTrend)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Issues List Section */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                    <h4 className="text-base font-medium text-gray-900 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-blue-500" />
                        Detailed Issue List
                        <span className="text-xs font-normal text-gray-500 ml-2">
                            (Top 100 recent issues in this period)
                        </span>
                    </h4>
                </div>

                {issuesLoading ? (
                    <div className="text-center py-8 text-gray-400">Loading issues...</div>
                ) : issuesData && issuesData.length > 0 ? (
                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto max-h-[400px]">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 sticky top-0 bg-gray-50 z-10">
                                    <tr>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap">Issue ID</th>
                                        <th className="px-4 py-3 font-medium">Severity</th>
                                        <th className="px-4 py-3 font-medium">Status</th>
                                        <th className="px-4 py-3 font-medium">Title / Signature</th>
                                        <th className="px-4 py-3 font-medium">Tenant</th>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap">Created At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {issuesData.map((issue) => (
                                        <tr key={issue.id} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="px-4 py-3 font-medium">
                                                <a
                                                    href={`https://tidb.atlassian.net/browse/${issue.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline font-mono"
                                                >
                                                    {issue.id}
                                                    <ExternalLink className="w-3 h-3 opacity-50" />
                                                </a>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={clsx(
                                                    "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize",
                                                    issue.priority === 'Critical' ? "bg-red-50 text-red-700 border-red-100" :
                                                        issue.priority === 'Major' ? "bg-orange-50 text-orange-700 border-orange-100" :
                                                            "bg-blue-50 text-blue-700 border-blue-100"
                                                )}>
                                                    {issue.priority}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={clsx(
                                                    "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                                                    issue.status === 'FAKE ALARM' ? "bg-gray-100 text-gray-600 border-gray-200" :
                                                        issue.status === 'Created' || issue.status === 'Reopened' ? "bg-green-50 text-green-700 border-green-200" :
                                                            "bg-white text-gray-700 border-gray-200"
                                                )}>
                                                    {issue.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-medium text-gray-900 truncate max-w-[300px]" title={issue.title}>
                                                        {issue.title || 'No Title'}
                                                    </span>
                                                    <span className="text-xs text-gray-500 truncate max-w-[300px]" title={issue.alert_signature}>
                                                        {issue.alert_signature}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                                                {issue.tenant_id || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <Clock className="w-3 h-3" />
                                                    {issue.created?.replace(' UTC', '')}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                        <Info className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <h3 className="text-sm font-medium text-gray-900">No Issues Found</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            No issues match the current filters in this period.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

