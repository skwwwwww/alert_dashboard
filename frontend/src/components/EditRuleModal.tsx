import { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { taskService } from '../services/taskService';


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

interface EditRuleModalProps {
    isOpen: boolean;
    onClose: () => void;
    rule: AlertRule | null;
    componentName: string;
    onSaveSuccess: () => void;
}

const KeyValueEditor = ({
    title,
    data,
    onChange,
    excludeKeys = [],
    fixedKeys = []
}: {
    title: string;
    data: Record<string, string>;
    onChange: (newData: Record<string, string>) => void;
    excludeKeys?: string[];
    fixedKeys?: string[];
}) => {
    // Let's iterate on the entries derived from data.
    const filteredEntries = Object.entries(data || {}).filter(([k]) => !excludeKeys.includes(k));

    const handleKeyChange = (oldKey: string, newKey: string, value: string) => {
        const newData = { ...data };
        delete newData[oldKey];
        newData[newKey] = value;
        onChange(newData);
    };

    const handleValueChange = (key: string, newValue: string) => {
        const newData = { ...data, [key]: newValue };
        onChange(newData);
    };

    const handleAdd = () => {
        const newData = { ...data, ['new_key_' + Date.now()]: '' };
        onChange(newData);
    };

    const handleDelete = (key: string) => {
        const newData = { ...data };
        delete newData[key];
        onChange(newData);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">{title}</label>
                <button
                    onClick={handleAdd}
                    type="button"
                    className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                >
                    <Plus className="w-3 h-3" /> Add Item
                </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-200">
                {filteredEntries.length === 0 && (
                    <div className="text-xs text-gray-400 text-center italic py-2">No additional items</div>
                )}
                {filteredEntries.map(([key, value], idx) => {
                    const isFixed = fixedKeys.includes(key);
                    return (
                        <div key={idx} className="flex items-start gap-2">
                            <input
                                type="text"
                                value={key}
                                onChange={(e) => handleKeyChange(key, e.target.value, value)}
                                placeholder="Key"
                                disabled={isFixed}
                                className={`flex-1 min-w-[120px] px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 ${isFixed ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                            />
                            <input
                                type="text"
                                value={value}
                                onChange={(e) => handleValueChange(key, e.target.value)}
                                placeholder="Value"
                                className="flex-[2] px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                            />
                            <button
                                onClick={() => handleDelete(key)}
                                disabled={isFixed}
                                className={`p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors ${isFixed ? 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-gray-400' : ''}`}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const EditRuleModal = ({ isOpen, onClose, rule, componentName, onSaveSuccess }: EditRuleModalProps) => {
    const [formData, setFormData] = useState<AlertRule | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Common governance labels that should not be renamed
    const FIXED_LABELS = [
        'severity',
        'component',
        'tier',
        'source_component',
        'stability_governance',
        'responsible_team',
        'source_tcoc',
        'visibility'
    ];

    useEffect(() => {
        if (rule) {
            // Deep copy
            setFormData(JSON.parse(JSON.stringify(rule)));
            setError(null);
        }
    }, [rule, isOpen]);

    if (!isOpen || !formData) return null;

    const handleSave = async () => {
        if (!formData) return;
        setIsSaving(true);
        setError(null);

        try {
            // Task Submission
            await taskService.createTask(
                formData,
                rule ? 'EDIT' : 'ADD',
                componentName,
                `User submitted ${rule ? 'update' : 'new rule'} for ${formData.alert}`
            );

            onSaveSuccess();
            onClose();
        } catch (err) {
            setError((err as any).message || 'Failed to submit task');
        } finally {
            setIsSaving(false);
        }
    };

    // Helper to update specific annotation/label
    const updateAnnotation = (key: string, value: string) => {
        setFormData(prev => prev ? {
            ...prev,
            annotations: { ...prev.annotations, [key]: value }
        } : null);
    };



    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900">Edit Rule</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-8">
                    {/* Error Message */}
                    {error && (
                        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div className="text-sm">{error}</div>
                        </div>
                    )}

                    {/* Section 1: Core Definitions */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2">Rule Definition</h3>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Alert Name</label>
                                <input
                                    type="text"
                                    value={formData.alert}
                                    onChange={e => setFormData({ ...formData, alert: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">For (Duration)</label>
                                <input
                                    type="text"
                                    value={formData.for}
                                    onChange={e => setFormData({ ...formData, for: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="e.g. 5m"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Expression (PromQL)</label>
                            <textarea
                                value={formData.expr}
                                onChange={e => setFormData({ ...formData, expr: e.target.value })}
                                rows={15}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50"
                            />
                        </div>
                    </div>

                    {/* Section 2: Metadata & Labels */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2">Labels & Metadata</h3>

                        <KeyValueEditor
                            title="Additional Labels"
                            data={formData.labels || {}}
                            onChange={(newLabels) => setFormData({ ...formData, labels: newLabels })}
                            fixedKeys={FIXED_LABELS}
                        />
                    </div>

                    {/* Section 3: Annotations & Documentation */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2">Annotations & Docs</h3>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Summary</label>
                            <input
                                type="text"
                                value={formData.annotations?.summary || ''}
                                onChange={e => updateAnnotation('summary', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Description</label>
                            <textarea
                                value={formData.annotations?.description || ''}
                                onChange={e => updateAnnotation('description', e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Detailed Message (message)</label>
                            <textarea
                                value={formData.annotations?.message || ''}
                                onChange={e => updateAnnotation('message', e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-xs"
                                placeholder="Detailed alert message template..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Runbook URL</label>
                                <input
                                    type="text"
                                    value={formData.annotations?.runbook_url || ''}
                                    onChange={e => updateAnnotation('runbook_url', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="https://..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">SOP URL</label>
                                <input
                                    type="text"
                                    value={formData.annotations?.sop_url || ''}
                                    onChange={e => updateAnnotation('sop_url', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        <KeyValueEditor
                            title="Additional Annotations"
                            data={formData.annotations || {}}
                            onChange={(newAnnotations) => setFormData({ ...formData, annotations: newAnnotations })}
                            excludeKeys={['summary', 'description', 'message', 'runbook_url', 'sop_url']}
                        />
                    </div>

                    {/* Section 3: Annotations & Documentation */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2">Annotations & Docs</h3>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Summary</label>
                            <input
                                type="text"
                                value={formData.annotations?.summary || ''}
                                onChange={e => updateAnnotation('summary', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Description</label>
                            <textarea
                                value={formData.annotations?.description || ''}
                                onChange={e => updateAnnotation('description', e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Detailed Message (message)</label>
                            <textarea
                                value={formData.annotations?.message || ''}
                                onChange={e => updateAnnotation('message', e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-xs"
                                placeholder="Detailed alert message template..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Runbook URL</label>
                                <input
                                    type="text"
                                    value={formData.annotations?.runbook_url || ''}
                                    onChange={e => updateAnnotation('runbook_url', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="https://..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">SOP URL</label>
                                <input
                                    type="text"
                                    value={formData.annotations?.sop_url || ''}
                                    onChange={e => updateAnnotation('sop_url', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        <KeyValueEditor
                            title="Additional Annotations"
                            data={formData.annotations || {}}
                            onChange={(newAnnotations) => setFormData({ ...formData, annotations: newAnnotations })}
                            excludeKeys={['summary', 'description', 'message', 'runbook_url', 'sop_url']}
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? 'Submitting...' : <><Save className="w-4 h-4" /> Submit Request</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
