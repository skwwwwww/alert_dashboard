import { useEffect, useState } from 'react';
import type { RuleTask } from '../types/task';
import { taskService } from '../services/taskService';
import { Clock, CheckCircle2, GitPullRequest, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';

interface RuleTaskListProps {
    componentName: string;
}

export const RuleTaskList = ({ componentName }: RuleTaskListProps) => {
    const [tasks, setTasks] = useState<RuleTask[]>([]);

    useEffect(() => {
        const loadTasks = async () => {
            try {
                const data = await taskService.getTasks(componentName);
                setTasks(data);
            } catch (error) {
                console.error("Failed to load tasks", error);
            }
        };

        loadTasks();

        // Poll every 2s for updates (since backend simulation is running)
        const interval = setInterval(loadTasks, 2000);

        return () => {
            clearInterval(interval);
        };
    }, [componentName]);

    const getStatusIcon = (status: RuleTask['status']) => {
        switch (status) {
            case 'submitted': return <Clock className="w-5 h-5 text-gray-500" />;
            case 'processing': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
            case 'waiting_for_review': return <GitPullRequest className="w-5 h-5 text-orange-500" />;
            case 'merged': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
            case 'rejected': return <XCircle className="w-5 h-5 text-red-500" />;
        }
    };

    const getStatusBadge = (status: RuleTask['status']) => {
        const styles = {
            submitted: "bg-gray-100 text-gray-700 border-gray-200",
            processing: "bg-blue-50 text-blue-700 border-blue-200",
            waiting_for_review: "bg-orange-50 text-orange-700 border-orange-200",
            merged: "bg-green-50 text-green-700 border-green-200",
            rejected: "bg-red-50 text-red-700 border-red-200",
        };

        return (
            <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize flex items-center gap-1.5", styles[status])}>
                {getStatusIcon(status)}
                {status.replace(/_/g, ' ')}
            </span>
        );
    };

    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

    const toggleDiff = (taskId: string) => {
        const newExpanded = new Set(expandedTasks);
        if (newExpanded.has(taskId)) {
            newExpanded.delete(taskId);
        } else {
            newExpanded.add(taskId);
        }
        setExpandedTasks(newExpanded);
    };

    if (tasks.length === 0) {
        return (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-500">No rule changes submitted yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {tasks.map((task) => (
                <div key={task.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className={clsx(
                                    "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                                    task.type === 'ADD' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                                )}>
                                    {task.type}
                                </span>
                                <h3 className="font-semibold text-gray-900">{task.rule.alert}</h3>
                            </div>
                            <p className="text-sm text-gray-600">{task.description}</p>
                            <div className="text-xs text-gray-400 mt-2 flex items-center gap-2">
                                <span>ID: {task.id}</span>
                                <span>•</span>
                                <span>{new Date(task.created_at).toLocaleString()}</span>
                                <span>•</span>
                                <span>By: {task.owner}</span>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-3">
                            {getStatusBadge(task.status)}

                            <div className="flex items-center gap-3">
                                {task.diff && (
                                    <button
                                        onClick={() => toggleDiff(task.id)}
                                        className="text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline flex items-center gap-1"
                                    >
                                        {expandedTasks.has(task.id) ? 'Hide Diff' : 'View Diff'}
                                    </button>
                                )}

                                {task.pr_link && (
                                    <a
                                        href={task.pr_link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                    >
                                        View PR <ArrowRight className="w-3 h-3" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar for visual feedback on processing */}
                    {task.status === 'processing' && (
                        <div className="mt-4 h-1.5 w-full bg-blue-50 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 animate-progress origin-left" style={{ width: '60%' }}></div>
                        </div>
                    )}

                    {/* Diff Viewer */}
                    {expandedTasks.has(task.id) && task.diff && (
                        <div className="mt-4 bg-gray-50 rounded border border-gray-200 p-3 overflow-x-auto">
                            <pre className="text-xs font-mono text-gray-700 whitespace-pre">{task.diff}</pre>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
