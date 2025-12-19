import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { RuleManager } from './RuleManager';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect } from 'react';
import { Panel } from '../components/Panel';
import { PeriodSelector } from '../components/PeriodSelector';
import { TrendChart } from '../components/TrendChart';
import { TrendModal } from '../components/TrendModal';
import { OverviewPanel } from '../components/OverviewPanel';
import { RecentIssuesPanel } from '../components/RecentIssuesPanel';

import { API_BASE_URL } from '../config/api';

// Types based on Go Backend Response
interface DailyTrend {
    date: string;
    total_alerts: number;
    critical_count: number;
    major_count: number;
    warning_count: number;
}

interface Issue {
    id: string;
    title: string;
    created: string;
    priority: string;
    status: string;
    alert_signature: string;
    cluster_name?: string;
}

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
    daily_trend: DailyTrend[];
    recent_issues: Issue[];
    top_tenants: {
        tenant_id: string;
        tenant_name?: string;
        current: number;
        previous: number;
        change: number;
        trend: "up" | "down" | "neutral";
    }[];
    top_clusters?: {
        cluster_id: string;
        cluster_name?: string;
        tenant_name?: string;
        current: number;
        previous: number;
        change: number;
        trend: "up" | "down" | "neutral";
    }[];
    top_rules: {
        signature: string;
        count: number;
    }[];
}



interface ComponentDetailProps {
    componentName: string;
    hideNavigation?: boolean;
    viewMode?: 'dashboard' | 'rules' | 'oncall';
}

export const ComponentDetail = ({ componentName, hideNavigation, viewMode }: ComponentDetailProps) => {
    // Three-tier navigation state
    const [category, setCategory] = useState<'premium' | 'dedicated' | 'essential'>('premium'); // Tier 1: Category
    const [activeTab, setActiveTab] = useState<'dashboard' | 'rules' | 'oncall'>(viewMode || 'dashboard'); // Tier 2: Content Type

    // Sync activeTab with viewMode if provided
    useEffect(() => {
        if (viewMode) setActiveTab(viewMode);
    }, [viewMode]);
    const [env, setEnv] = useState<'prod' | 'non_prod'>('prod'); // Tier 3: Environment (only in Dashboard)


    // Independent period state for each panel
    const [metricsDays, setMetricsDays] = useState(7);
    const [metricsStep, setMetricsStep] = useState('day');
    const [tenantsDays, setTenantsDays] = useState(7);
    const [clustersDays, setClustersDays] = useState(7);
    const [signaturesDays, setSignaturesDays] = useState(7);

    // Modal state for trend viewing
    const [trendModal, setTrendModal] = useState<{
        isOpen: boolean;
        title: string;
        tenantId?: string;
        clusterId?: string;
        signature?: string;
        metricType?: 'total' | 'critical';
    }>({ isOpen: false, title: '' });

    // Separate queries for each panel with category
    // Force Essential category for Serverless component
    useEffect(() => {
        if (componentName === 'Serverless' && category !== 'essential') {
            setCategory('essential');
        }
    }, [componentName, category]);

    // 1. Fetch Stats (existing code)
    const { data: metricsData, isLoading: metricsLoading, error: metricsError } = useQuery({
        queryKey: ['componentMetrics', componentName, category, metricsDays, metricsStep, env],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/components/${componentName}/stats?days=${metricsDays}&env=${env}&category=${category}&step=${metricsStep}`);
            return res.data as ComponentStats;
        }
    });

    const { data: tenantsData } = useQuery({
        queryKey: ['componentTenants', componentName, category, tenantsDays, env],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/components/${componentName}/stats?days=${tenantsDays}&env=${env}&category=${category}`);
            return res.data as ComponentStats;
        }
    });

    const { data: clustersData } = useQuery({
        queryKey: ['componentClusters', componentName, category, clustersDays, env],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/components/${componentName}/stats?days=${clustersDays}&env=${env}&category=${category}`);
            return res.data as ComponentStats;
        }
    });

    const { data: signaturesData } = useQuery({
        queryKey: ['componentSignatures', componentName, category, signaturesDays, env],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/components/${componentName}/stats?days=${signaturesDays}&env=${env}&category=${category}`);
            return res.data as ComponentStats;
        }
    });



    if (metricsLoading) return <div className="p-8 text-muted-foreground animate-pulse">Loading component statistics...</div>;

    if (metricsError) {
        return (
            <div className="p-8 text-red-600 bg-red-50 rounded-lg border border-red-200">
                <h3 className="text-lg font-semibold">Error Loading Component Data</h3>
                <p className="text-sm mt-2">{(metricsError as Error).message}</p>
                <pre className="text-xs mt-4 bg-white p-2 rounded overflow-auto">
                    {JSON.stringify(metricsError, null, 2)}
                </pre>
            </div>
        );
    }

    if (!metricsData) return <div className="p-8">No data available (Metrics Data is null)</div>;

    const stats = metricsData; // For KPI cards and header

    return (
        <div className={clsx("animate-in fade-in duration-500", activeTab === 'rules' ? "space-y-4" : "space-y-8")}>
            {/* Header */}
            {!hideNavigation && (
                <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-3xl font-bold tracking-tight">{stats.component}</h1>
                                <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide",
                                    env === 'prod' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                                )}>
                                    {env === 'prod' ? 'Production' : 'Non-Prod'}
                                </span>
                            </div>
                            <p className="text-muted-foreground mt-1">Component Health & Operations</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Three-Tier Navigation */}
            <div className="space-y-6">

                {/* Tier 2: Content Type - Secondary */}
                {!hideNavigation && (
                    <div className="border-b border-gray-200">
                        <div className="flex gap-8">
                            <button
                                onClick={() => setActiveTab('dashboard')}
                                className={clsx("pb-3 px-1 text-base font-semibold border-b-2 transition-colors",
                                    activeTab === 'dashboard'
                                        ? "border-blue-600 text-gray-900"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                )}
                            >
                                Alerts Dashboard
                            </button>
                            <button
                                onClick={() => setActiveTab('rules')}
                                className={clsx("pb-3 px-1 text-base font-semibold border-b-2 transition-colors",
                                    activeTab === 'rules'
                                        ? "border-blue-600 text-gray-900"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                )}
                            >
                                RulesManager
                            </button>
                            <button
                                onClick={() => setActiveTab('oncall')}
                                className={clsx("pb-3 px-1 text-base font-semibold border-b-2 transition-colors",
                                    activeTab === 'oncall'
                                        ? "border-blue-600 text-gray-900"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                )}
                            >
                                Oncall Dashboard
                            </button>
                        </div>
                    </div>
                )}

                {/* Serverless Jump Link */}
                {category === 'essential' && componentName !== 'Serverless' && (
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 rounded-lg p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 text-sm text-purple-900">
                            <Activity className="w-4 h-4 text-purple-600" />
                            <span>Viewing <strong>{componentName}</strong> Serverless tier issues.</span>
                        </div>
                        <a
                            href="/components/Serverless"
                            className="text-sm font-semibold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1"
                        >
                            View All Serverless Issues <TrendingUp className="w-3 h-3" />
                        </a>
                    </div>
                )}
            </div>

            {activeTab === 'dashboard' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Tier 3: Environment Filter - Tertiary (only in Dashboard) */}
                    {/* Filters: Service Tier & Environment */}
                    <div className="flex flex-wrap items-center gap-8">
                        {/* Service Tier Filter */}
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">Service Tier:</span>
                            <div className="flex gap-1 p-0.5 bg-gray-50 rounded-lg border border-gray-200">
                                <button
                                    onClick={() => setCategory('premium')}
                                    className={clsx("px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                                        category === 'premium' ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200" : "text-gray-500 hover:text-gray-700"
                                    )}
                                >
                                    Premium
                                </button>
                                <button
                                    onClick={() => setCategory('dedicated')}
                                    className={clsx("px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                                        category === 'dedicated' ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200" : "text-gray-500 hover:text-gray-700"
                                    )}
                                >
                                    Dedicated
                                </button>
                            </div>
                        </div>

                        {/* Environment Filter */}
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">Environment:</span>
                            <div className="flex gap-2 p-0.5 bg-gray-50 rounded-lg border border-gray-200">
                                <button
                                    onClick={() => setEnv('prod')}
                                    className={clsx("px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                                        env === 'prod'
                                            ? "bg-white text-purple-700 shadow-sm ring-1 ring-purple-200"
                                            : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                                    )}
                                >
                                    Production
                                </button>
                                <button
                                    onClick={() => setEnv('non_prod')}
                                    className={clsx("px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                                        env === 'non_prod'
                                            ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                                            : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                                    )}
                                >
                                    Non-Production
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* NEW: Overview Panel (Replaces old individual cards) */}
                    <OverviewPanel
                        stats={stats}
                        days={metricsDays}
                        onDaysChange={setMetricsDays}
                        step={metricsStep}
                        onStepChange={setMetricsStep}
                        env={env}
                        componentName={componentName}
                        category={category}
                    />


                    {/* Top 10 Tenants */}
                    <Panel
                        title="Top 10 Tenants"
                        additionalToolbar={
                            <PeriodSelector
                                options={[
                                    { id: 7, label: 'Last 7 Days' },
                                    { id: 30, label: 'Last 30 Days' },
                                    { id: 90, label: 'Last 90 Days' }
                                ]}
                                selected={tenantsDays}
                                onChange={(id) => setTenantsDays(id as number)}
                                size="sm"
                            />
                        }
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold">Tenant</th>
                                        <th className="px-6 py-3 font-semibold text-right">Current Alerts</th>
                                        <th className="px-6 py-3 font-semibold text-right">Prev {tenantsDays} Days</th>
                                        <th className="px-6 py-3 font-semibold text-right">Trend</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {tenantsData?.top_tenants?.map((tenant) => (
                                        <tr
                                            key={tenant.tenant_id}
                                            className="hover:bg-blue-50 hover:shadow-sm transition-all group cursor-pointer hover:scale-[1.01] relative"
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
                                                <div className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                                                    Click to view trend
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
                                    {(!tenantsData?.top_tenants || tenantsData.top_tenants.length === 0) && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                                                No tenant data available for this component.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Panel>

                    {/* Top 10 Clusters */}
                    <Panel
                        title="Top 10 Clusters"
                        additionalToolbar={
                            <PeriodSelector
                                options={[
                                    { id: 7, label: 'Last 7 Days' },
                                    { id: 30, label: 'Last 30 Days' },
                                    { id: 90, label: 'Last 90 Days' }
                                ]}
                                selected={clustersDays}
                                onChange={(id) => setClustersDays(id as number)}
                                size="sm"
                            />
                        }
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold">Cluster</th>
                                        <th className="px-6 py-3 font-semibold text-right">Current Alerts</th>
                                        <th className="px-6 py-3 font-semibold text-right">Prev {clustersDays} Days</th>
                                        <th className="px-6 py-3 font-semibold text-right">Trend</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {clustersData?.top_clusters?.slice(0, 10).map((cluster) => (
                                        <tr
                                            key={cluster.cluster_id}
                                            className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                                            onClick={() => setTrendModal({
                                                isOpen: true,
                                                title: `${componentName} - Cluster ${cluster.cluster_id}`,
                                                metricType: 'total',
                                                clusterId: cluster.cluster_id
                                            })}
                                        >
                                            <td className="px-6 py-4 font-mono text-xs text-gray-600 group-hover:text-blue-700 font-medium transition-colors">
                                                <div className="flex flex-col">
                                                    {cluster.tenant_name && (
                                                        <span className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5 font-sans">{cluster.tenant_name}</span>
                                                    )}
                                                    {cluster.cluster_name ? (
                                                        <>
                                                            <span className="text-sm font-semibold text-gray-900 font-sans">{cluster.cluster_name}</span>
                                                            <span className="text-[10px] text-gray-400">{cluster.cluster_id}</span>
                                                        </>
                                                    ) : (
                                                        cluster.cluster_id
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
                                    {(!clustersData?.top_clusters || clustersData.top_clusters.length === 0) && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                                                No cluster data available for this component.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Panel>

                    {/* Top 10 Alert Signatures */}
                    <Panel
                        title="Top 10 Alert Signatures"
                        additionalToolbar={
                            <PeriodSelector
                                options={[
                                    { id: 7, label: 'Last 7 Days' },
                                    { id: 30, label: 'Last 30 Days' },
                                    { id: 90, label: 'Last 90 Days' }
                                ]}
                                selected={signaturesDays}
                                onChange={(id) => setSignaturesDays(id as number)}
                                size="sm"
                            />
                        }
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold">Signature</th>
                                        <th className="px-6 py-3 font-semibold text-right">Count</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {signaturesData?.top_rules?.map((rule, idx) => (
                                        <tr
                                            key={idx}
                                            className="hover:bg-blue-50 hover:shadow-sm transition-all cursor-pointer group hover:scale-[1.01]"
                                            onClick={() => setTrendModal({
                                                isOpen: true,
                                                title: `Signature: ${rule.signature.substring(0, 50)}... - Alert Trend`,
                                                signature: rule.signature
                                            })}
                                        >
                                            <td className="px-6 py-4 font-mono text-xs text-gray-600 font-medium group-hover:text-blue-700 transition-colors">
                                                {rule.signature}
                                                <div className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Click to view trend
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-gray-900">
                                                {rule.count.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!signaturesData?.top_rules || signaturesData.top_rules.length === 0) && (
                                        <tr>
                                            <td colSpan={2} className="px-6 py-8 text-center text-muted-foreground">
                                                No alert signature data available for this component.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Panel>

                    {/* Recent Critical & Major Issues Panel */}
                    <RecentIssuesPanel componentName={componentName} env={env} category={category} />

                </div>
            ) : activeTab === 'oncall' ? (
                <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl bg-white/50 animate-in fade-in duration-500">
                    Oncall Dashboard content coming soon...
                </div>
            ) : (
                <RuleManager componentName={componentName} />
            )}

            {/* Trend Modal */}
            <TrendModal
                isOpen={trendModal.isOpen}
                onClose={() => setTrendModal({ isOpen: false, title: '' })}
            >
                <TrendChart
                    title={trendModal.title}
                    component={componentName}
                    tenantId={trendModal.tenantId}
                    clusterId={trendModal.clusterId}
                    signature={trendModal.signature}
                    metricType={trendModal.metricType}
                    env={env}
                />
            </TrendModal>
        </div >
    );
};
