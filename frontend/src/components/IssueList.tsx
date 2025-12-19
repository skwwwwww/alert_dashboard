import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { clsx } from 'clsx';
import { ExternalLink, Clock, AlertCircle, Info } from 'lucide-react';

interface IssueListProps {
    title: string;
    component?: string;
    tenantId?: string;
    clusterId?: string;
    signature?: string;
    env?: string;
    metricType?: 'total' | 'critical' | 'prod' | 'non_prod' | 'fake' | 'handled';
    category?: string;
    days?: number;
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

export const IssueList = ({
    title,
    component,
    tenantId,
    clusterId,
    signature,
    env = 'all',
    metricType,
    category,
    days = 7
}: IssueListProps) => {

    const { data: issuesData, isLoading: issuesLoading } = useQuery({
        queryKey: ['issueList', component, tenantId, clusterId, signature, env, metricType, category, days],
        queryFn: async () => {
            let queryEnv = env;
            if (metricType === 'prod') {
                queryEnv = 'prod';
            } else if (metricType === 'non_prod') {
                queryEnv = 'non_prod';
            }

            let url = `${API_BASE_URL}/dashboard/issues?days=${days}&env=${queryEnv}&limit=100`;

            if (component) url += `&component=${encodeURIComponent(component)}`;
            if (tenantId) url += `&tenant_id=${encodeURIComponent(tenantId)}`;
            if (clusterId) url += `&cluster_id=${encodeURIComponent(clusterId)}`;
            if (signature) url += `&signature=${encodeURIComponent(signature)}`;
            if (category) url += `&category=${encodeURIComponent(category)}`;

            if (metricType && metricType !== 'total' && metricType !== 'prod' && metricType !== 'non_prod') {
                // For prod/non_prod, we handle it via env override above.
                // For others (fake, handled, critical), pass as metric_type.
                url += `&metric_type=${metricType}`;
            }

            const res = await axios.get(url);
            return res.data as Issue[];
        }
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            </div>

            <div className="space-y-4 pt-2">
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
                        <div className="overflow-x-auto max-h-[600px]">
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
