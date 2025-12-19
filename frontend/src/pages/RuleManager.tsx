import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { clsx } from 'clsx';
import { ListTodo, Search, Plus, FileText, Pencil } from 'lucide-react';
import { RuleTaskList } from '../components/RuleTaskList';
import { EditRuleModal } from '../components/EditRuleModal';
import { API_BASE_URL } from '../config/api';

interface AlertRule {
    alert: string;
    expr: string;
    for: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    file_path: string;
    category: string;
    rule_type?: string;
}

interface RuleManagerProps {
    componentName: string;
}

export const RuleManager = ({ componentName }: RuleManagerProps) => {
    const [category, setCategory] = useState<'premium' | 'dedicated' | 'essential'>('premium');
    const [ruleType, setRuleType] = useState<'prometheus' | 'logging'>('prometheus');
    const [viewMode, setViewMode] = useState<'rules' | 'tasks'>('rules');
    const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
    const [isAddingRule, setIsAddingRule] = useState(false);

    const { data: rules, isLoading: rulesLoading, refetch: refetchRules } = useQuery({
        queryKey: ['componentRules', componentName, category, ruleType],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/components/${componentName}/rules?category=${category}&rule_type=${ruleType}`);
            return res.data as AlertRule[];
        }
    });

    const handleAddRule = () => {
        setIsAddingRule(true);
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Filters & Rule Type */}
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-6">
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

                    <div className="w-px h-8 bg-gray-200" />

                    <div className="flex p-1 bg-gray-100 rounded-lg">
                        <button
                            onClick={() => setRuleType('prometheus')}
                            className={clsx("px-4 py-2 text-sm font-medium rounded-md transition-all",
                                ruleType === 'prometheus'
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                            )}
                        >
                            Prometheus Rules
                        </button>
                        <button
                            onClick={() => setRuleType('logging')}
                            className={clsx("px-4 py-2 text-sm font-medium rounded-md transition-all",
                                ruleType === 'logging'
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                            )}
                        >
                            Logging Rules
                        </button>
                    </div>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-4 border-b border-gray-200 pb-2 mb-2">
                    <button
                        onClick={() => setViewMode('rules')}
                        className={clsx("pb-2 px-1 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2",
                            viewMode === 'rules'
                                ? "border-blue-600 text-gray-900"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        )}
                    >
                        Active Rules
                    </button>
                    <button
                        onClick={() => setViewMode('tasks')}
                        className={clsx("pb-2 px-1 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2",
                            viewMode === 'tasks'
                                ? "border-blue-600 text-gray-900"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        )}
                    >
                        <ListTodo className="w-4 h-4" />
                        Change Tasks
                    </button>
                    <div className="flex-1" />
                    {viewMode === 'rules' && (
                        <div className="flex items-center justify-between gap-4">
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search rules..."
                                    className="w-full pl-9 pr-4 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <button
                                onClick={handleAddRule}
                                className="flex items-center gap-2 px-4 py-1.5 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Add Rule
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {viewMode === 'tasks' ? (
                <RuleTaskList componentName={componentName} />
            ) : rulesLoading ? (
                <div className="p-12 text-center text-muted-foreground">Loading specific rules for {componentName}...</div>
            ) : rules && rules.length > 0 ? (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Alert Name</th>
                                    <th className="px-6 py-3 font-medium">Severity</th>
                                    <th className="px-6 py-3 font-medium">Duration</th>
                                    <th className="px-6 py-3 font-medium">Component(Response Team)</th>
                                    <th className="px-6 py-3 font-medium">Tier</th>
                                    <th className="px-6 py-3 font-medium">Source Component</th>
                                    <th className="px-6 py-3 font-medium">Stability Governance</th>
                                    <th className="px-6 py-3 font-medium">File Source</th>
                                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {rules.map((rule, idx) => (
                                    <tr key={idx} className="hover:bg-muted/50 transition-colors group">
                                        <td className="px-6 py-4 font-medium group-hover:text-primary transition-colors">
                                            {rule.alert}
                                            <div className="text-xs text-muted-foreground font-normal mt-0.5 max-w-md truncate">
                                                {rule.annotations?.summary}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={clsx(
                                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize",
                                                rule.labels?.severity === 'critical' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                    rule.labels?.severity === 'major' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                                                        "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                            )}>
                                                {rule.labels?.severity || 'unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                                            {rule.for || '0s'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {rule.labels?.component || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {rule.labels?.tier || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {rule.labels?.source_component || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {rule.labels?.stability_governance || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1.5" title={rule.file_path}>
                                                <FileText className="w-3 h-3" />
                                                <span className="truncate max-w-[150px]">
                                                    {rule.file_path.split('/').pop()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setEditingRule(rule)}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Edit Rule"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="p-12 rounded-xl border border-dashed border-border text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Search className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">No Rules Found</h3>
                    <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                        We couldn't find any alert rules defined for <strong>{componentName}</strong> in the repository.
                    </p>
                </div>
            )}

            <EditRuleModal
                isOpen={!!editingRule}
                onClose={() => setEditingRule(null)}
                rule={editingRule}
                componentName={componentName}
                onSaveSuccess={() => {
                    refetchRules();
                }}
            />

            <EditRuleModal
                isOpen={isAddingRule}
                onClose={() => setIsAddingRule(false)}
                rule={{
                    alert: '',
                    expr: '',
                    for: '',
                    labels: {
                        severity: '',
                        component: '',
                        tier: '',
                        source_component: '',
                        stability_governance: '',
                        responsible_team: '',
                        source_tcoc: '',
                        visibility: ''
                    },
                    annotations: {},
                    file_path: '',
                    category: category,
                    rule_type: ruleType
                }}
                componentName={componentName}
                onSaveSuccess={() => {
                    refetchRules();
                    setIsAddingRule(false);
                }}
            />
        </div>
    );
};
