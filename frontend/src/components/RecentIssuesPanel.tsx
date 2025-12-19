import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { Clock, AlertTriangle, VolumeX } from 'lucide-react';
import { clsx } from 'clsx';

interface Issue {
    id: string;
    title: string;
    created: string;
    priority: string;
    status: string;
    alert_signature: string;
    components: string;
    tenant_id?: string;
    cluster_id?: string;
}

interface RecentIssuesPanelProps {
    componentName: string;
    env: string;
    category?: string;
}

export const RecentIssuesPanel = ({ componentName, env, category }: RecentIssuesPanelProps) => {
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const { data: issues, isLoading } = useQuery<Issue[]>({
        queryKey: ['recentIssues', componentName, env, category, page],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/dashboard/issues`, {
                params: {
                    component: componentName,
                    env,
                    category,
                    priority: 'Critical,Major',
                    page,
                    page_size: pageSize
                }
            });
            return res.data;
        },
        placeholderData: keepPreviousData
    });

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-8" >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                <div>
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        Recent Critical & Major Issues
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">High severity issues affecting this component</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Previous
                    </button>
                    <span className="text-xs text-gray-500 font-medium px-2">Page {page}</span>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={!issues || issues.length < pageSize}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                {isLoading ? (
                    <div className="p-8 text-center text-sm text-gray-500">Loading issues...</div>
                ) : !issues || issues.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500">No recent critical or major issues found.</div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 font-medium">Time (UTC)</th>
                                <th className="px-6 py-3 font-medium">Severity</th>
                                <th className="px-6 py-3 font-medium">Status</th>
                                <th className="px-6 py-3 font-medium">Issue</th>
                                <th className="px-6 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {issues.map(issue => (
                                <tr key={issue.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3 h-3" />
                                            {issue.created?.replace(' UTC', '')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={clsx(
                                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize",
                                            issue.priority === 'Critical' ? "bg-red-50 text-red-700 border-red-100" :
                                                issue.priority === 'Major' ? "bg-orange-50 text-orange-700 border-orange-100" :
                                                    "bg-blue-50 text-blue-700 border-blue-100"
                                        )}>
                                            {issue.priority}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={clsx(
                                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                                            issue.status === 'FAKE ALARM' ? "bg-gray-100 text-gray-600 border-gray-200" :
                                                issue.status === 'Created' || issue.status === 'Reopened' ? "bg-green-50 text-green-700 border-green-200" :
                                                    "bg-white text-gray-700 border-gray-200"
                                        )}>
                                            {issue.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-0.5">
                                            <a
                                                href={`https://tidb.atlassian.net/browse/${issue.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-medium text-gray-900 truncate max-w-[400px] hover:text-blue-600 hover:underline"
                                            >
                                                {issue.title}
                                            </a>
                                            <span className="text-xs text-gray-500 font-mono">{issue.id} • {issue.alert_signature}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => window.open('https://alertmanager.prod.aws.observability.tidbcloud.com/?q=severity%3Dcritical&q=%40state%3Dactive', '_blank')}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                                            title="Go to Alertmanager to silence"
                                        >
                                            <VolumeX className="w-3.5 h-3.5" />
                                            Silence
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div >
    );
};
