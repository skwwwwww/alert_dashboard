import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { Activity, AlertOctagon, TrendingDown, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import { useState } from 'react';
import { Panel } from './Panel';
import { MetricCard } from './MetricCard';
import { PeriodSelector } from './PeriodSelector';
import { TrendChart } from './TrendChart';
import { TrendModal } from './TrendModal';

interface MetricStat {
    current: number;
    previous: number;
    change: number;
    trend: "up" | "down" | "neutral";
}

interface TenantCount {
    tenant_id: string;
    tenant_name: string;
    current: number;
    previous: number;
    change: number;
    trend: "up" | "down" | "neutral";
}

interface ClusterCount {
    cluster_id: string;
    cluster_name: string;
    tenant_name: string;
    current: number;
    previous: number;
    change: number;
    trend: "up" | "down" | "neutral";
}

interface DashboardData {
    totalAlerts: MetricStat;
    fakeAlarmRate: MetricStat;
    handlingRate: MetricStat;
    prodAlerts: MetricStat;
    nonProdAlerts: MetricStat;
    criticalAlerts: MetricStat;
    byPriority: { priority: string; count: number }[];
    bySignature: { signature: string; total_count: number; last_seen: string }[];
    byComponent: { component: string; count: number }[];
    byTenant: TenantCount[];
    byCluster: ClusterCount[];
    dailyTrend: { date: string; total_alerts: number; critical_count: number }[];
}

export const GlobalDashboard = () => {
    const [env, setEnv] = useState<'all' | 'prod' | 'non_prod'>('all');

    // Each panel will have its own period state
    const [metricsDays, setMetricsDays] = useState(7);
    const [componentsDays, setComponentsDays] = useState(7);

    // Modal state for trend viewing
    const [trendModal, setTrendModal] = useState<{
        isOpen: boolean;
        title: string;
        tenantId?: string;
        clusterId?: string;
        component?: string;
        signature?: string;
        metricType?: 'total' | 'critical' | 'prod' | 'non_prod' | 'fake' | 'handled';
    }>({ isOpen: false, title: '' });

    // Separate queries for each panel to ensure independence
    const { data: metricsData, isLoading: metricsLoading, error: metricsError } = useQuery({
        queryKey: ['dashboard-metrics', metricsDays, env],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/dashboard?days=${metricsDays}&env=${env}`);
            return res.data as DashboardData;
        }
    });

    const { data: componentsData, isLoading: componentsLoading } = useQuery({
        queryKey: ['dashboard-components', componentsDays, env],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/dashboard?days=${componentsDays}&env=${env}`);
            return res.data as DashboardData;
        }
    });

    const isLoading = metricsLoading || componentsLoading;
    const data = metricsData; // For shared data like tenants table


    if (isLoading) return <div className="p-12 text-center text-muted-foreground animate-pulse">Loading platform metrics...</div>;
    if (metricsError) return <div className="p-12 text-center text-red-500">Error loading dashboard: {String(metricsError)}</div>;
    if (!data) return null;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header & Controls */}
            <div className="flex flex-col gap-4">
                {/* Env Tabs */}
                <PeriodSelector
                    options={[
                        { id: 'all', label: 'All Environments' },
                        { id: 'prod', label: 'Production' },
                        { id: 'non_prod', label: 'Non-Production' }
                    ]}
                    selected={env}
                    onChange={(id) => setEnv(id as any)}
                    variant="tabs"
                />
            </div>


            {/* Metric Cards */}
            <Panel
                title="Key Metrics"
                additionalToolbar={
                    <PeriodSelector
                        options={[
                            { id: 7, label: '7d' },
                            { id: 30, label: '30d' },
                            { id: 90, label: '90d' }
                        ]}
                        selected={metricsDays}
                        onChange={(id) => setMetricsDays(id as number)}
                        size="sm"
                    />
                }
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        label="Total Alerts"
                        value={data.totalAlerts.current}
                        trend={{ value: data.totalAlerts.change }}
                        icon={<Activity className="w-4 h-4" />}
                        onClick={() => setTrendModal({
                            isOpen: true,
                            title: 'Total Alerts - Trend Analysis',
                            metricType: 'total'
                        })}
                    />
                    <MetricCard
                        label="Handling Rate"
                        value={`${data.handlingRate.current.toFixed(1)}%`}
                        trend={{ value: data.handlingRate.change }}
                        icon={<Activity className="w-4 h-4" />}
                        onClick={() => setTrendModal({
                            isOpen: true,
                            title: 'Handling Rate Analysis',
                            metricType: 'handled'
                        })}
                    />
                    <MetricCard
                        label="False Positive Rate"
                        value={`${data.fakeAlarmRate.current.toFixed(1)}%`}
                        trend={{ value: data.fakeAlarmRate.change }}
                        icon={<Activity className="w-4 h-4" />}
                        onClick={() => setTrendModal({
                            isOpen: true,
                            title: 'False Positive Rate Analysis',
                            metricType: 'fake'
                        })}
                    />
                    <MetricCard
                        label="Critical Alerts"
                        value={data.criticalAlerts.current}
                        trend={{ value: data.criticalAlerts.change }}
                        icon={<AlertOctagon className="w-4 h-4" />}
                        onClick={() => setTrendModal({
                            isOpen: true,
                            title: 'Critical Alerts - Trend Analysis',
                            metricType: 'critical'
                        })}
                    />
                </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Trend Chart */}
                <Panel
                    className="lg:col-span-2"
                    title="Alert Trend"
                >
                    <TrendChart
                        title=""
                        env={env}
                    />
                </Panel>

                {/* Top Components */}
                <Panel
                    title="Top 10 Components"
                    additionalToolbar={
                        <PeriodSelector
                            options={[
                                { id: 7, label: 'Last 7 Days' },
                                { id: 30, label: 'Last 30 Days' },
                                { id: 90, label: 'Last 90 Days' }
                            ]}
                            selected={componentsDays}
                            onChange={(id) => setComponentsDays(id as number)}
                            size="sm"
                        />
                    }
                >
                    <div className="space-y-5">
                        {(componentsData?.byComponent || []).slice(0, 10).map((comp, i) => (
                            <div
                                key={comp.component}
                                className="group cursor-pointer"
                                onClick={() => setTrendModal({
                                    isOpen: true,
                                    title: `Component ${comp.component} - Alert Trend`,
                                    component: comp.component
                                })}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-3">
                                        <div className={clsx(
                                            "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
                                            i === 0 ? "bg-red-100 text-red-600" :
                                                i === 1 ? "bg-orange-100 text-orange-600" :
                                                    i === 2 ? "bg-yellow-100 text-yellow-600" :
                                                        "bg-slate-100 text-slate-600"
                                        )}>
                                            {i + 1}
                                        </div>
                                        <div className="font-medium text-sm text-gray-700 group-hover:text-blue-600 transition-colors">
                                            {comp.component}
                                        </div>
                                    </div>
                                    <span className="text-sm font-semibold text-gray-900">{comp.count.toLocaleString()}</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={clsx("h-full rounded-full",
                                            i === 0 ? "bg-red-500" :
                                                i === 1 ? "bg-orange-500" :
                                                    "bg-blue-500"
                                        )}
                                        style={{ width: `${(comp.count / (componentsData?.totalAlerts.current || 1)) * 100 * 4}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>


            {/* Top Tenants */}
            <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border bg-gray-50/50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900">Top 10 Tenants</h3>
                        <div className="text-sm text-muted-foreground">vs Previous {metricsDays} Days</div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 font-semibold">Tenant ID</th>
                                <th className="px-6 py-3 font-semibold text-right">Current Alerts</th>
                                <th className="px-6 py-3 font-semibold text-right">Prev {metricsDays} Days</th>
                                <th className="px-6 py-3 font-semibold text-right">Trend</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(data.byTenant || []).map((tenant) => (
                                <tr
                                    key={tenant.tenant_id}
                                    className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                                    onClick={() => setTrendModal({
                                        isOpen: true,
                                        title: `Tenant ${tenant.tenant_id} - Alert Trend`,
                                        tenantId: tenant.tenant_id
                                    })}
                                >
                                    <td className="px-6 py-4 font-mono text-xs text-gray-600 group-hover:text-blue-700 font-medium transition-colors">
                                        <div className="flex flex-col">
                                            {tenant.tenant_name ? (
                                                <>
                                                    <span className="text-sm font-semibold text-gray-900 font-sans">{tenant.tenant_name}</span>
                                                    <span className="text-[10px] text-gray-400">{tenant.tenant_id}</span>
                                                </>
                                            ) : (
                                                tenant.tenant_id
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                                        {tenant.current.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-500">
                                        {tenant.previous.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {tenant.change !== 0 && (
                                                tenant.change > 0 ? <TrendingUp className="w-4 h-4 text-red-500" /> : <TrendingDown className="w-4 h-4 text-green-500" />
                                            )}
                                            <span className={clsx("font-semibold", tenant.change > 0 ? "text-red-500" : "text-green-500")}>
                                                {tenant.change > 0 && '+'}{Math.round(tenant.change * 10) / 10}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Top Clusters */}
            <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border bg-gray-50/50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900">Top 10 Clusters</h3>
                        <div className="text-sm text-muted-foreground">vs Previous {metricsDays} Days</div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 font-semibold">Cluster</th>
                                <th className="px-6 py-3 font-semibold text-right">Current Alerts</th>
                                <th className="px-6 py-3 font-semibold text-right">Prev {metricsDays} Days</th>
                                <th className="px-6 py-3 font-semibold text-right">Trend</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(data.byCluster || []).map((cluster) => (
                                <tr
                                    key={cluster.cluster_id}
                                    className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                                    onClick={() => setTrendModal({
                                        isOpen: true,
                                        title: `Cluster ${cluster.cluster_name || cluster.cluster_id} - Alert Trend`,
                                        clusterId: cluster.cluster_id
                                    })}
                                >
                                    <td className="px-6 py-4 font-mono text-xs text-gray-600 group-hover:text-blue-700 font-medium transition-colors">
                                        <div className="flex flex-col">
                                            {cluster.cluster_name ? (
                                                <>
                                                    <span className="text-sm font-semibold text-gray-900 font-sans">{cluster.cluster_name}</span>
                                                    <span className="text-[10px] text-gray-400">{cluster.cluster_id}</span>
                                                </>
                                            ) : (
                                                cluster.cluster_id
                                            )}
                                            {cluster.tenant_name && (
                                                <span className="text-[10px] text-gray-400 mt-0.5">Tenant: {cluster.tenant_name}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                                        {cluster.current.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-500">
                                        {cluster.previous.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {cluster.change !== 0 && (
                                                cluster.change > 0 ? <TrendingUp className="w-4 h-4 text-red-500" /> : <TrendingDown className="w-4 h-4 text-green-500" />
                                            )}
                                            <span className={clsx("font-semibold", cluster.change > 0 ? "text-red-500" : "text-green-500")}>
                                                {cluster.change > 0 && '+'}{Math.round(cluster.change * 10) / 10}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Top Signatures */}
            <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border bg-gray-50/50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900">Top 10 Alert Signatures</h3>
                        <button className="text-sm text-blue-600 font-medium hover:underline">View All</button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 font-semibold">Signature</th>
                                <th className="px-6 py-3 font-semibold text-right">Count</th>
                                <th className="px-6 py-3 font-semibold text-right">Last Seen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(data.bySignature || []).map((sig) => (
                                <tr
                                    key={sig.signature}
                                    className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                                    onClick={() => setTrendModal({
                                        isOpen: true,
                                        title: `Signature: ${sig.signature.substring(0, 50)}... - Alert Trend`,
                                        signature: sig.signature
                                    })}
                                >
                                    <td className="px-6 py-4 font-mono text-xs text-gray-600 group-hover:text-blue-700 font-medium transition-colors">
                                        {sig.signature}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                                        {sig.total_count}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-500">
                                        {sig.last_seen.replace(" UTC", "")}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Trend Modal */}
            <TrendModal
                isOpen={trendModal.isOpen}
                onClose={() => setTrendModal({ isOpen: false, title: '' })}
            >
                <TrendChart
                    title={trendModal.title}
                    env={env}
                    metricType={trendModal.metricType}
                    component={trendModal.component}
                    tenantId={trendModal.tenantId}
                    clusterId={trendModal.clusterId}
                    signature={trendModal.signature}
                />
            </TrendModal>
        </div>
    );
};
