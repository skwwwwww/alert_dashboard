import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { clsx } from 'clsx';
import { ShieldAlert, Trash2, Plus, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

interface RulesNotifyEntry {
    type: string;
    id: string;
}

interface RulesNotifyConfig {
    nextgen_blacklist: RulesNotifyEntry[];
    dedicated_whitelist: RulesNotifyEntry[];
}

export const RulesNotifyManager = () => {
    const queryClient = useQueryClient();
    const [newItem, setNewItem] = useState<{
        section: 'nextgen' | 'dedicated';
        type: 'tenant' | 'cluster';
        id: string;
    } | null>(null);

    const { data: config, isLoading, error } = useQuery({
        queryKey: ['rulesNotifyConfig'],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/rules-notify-manager`);
            return res.data as RulesNotifyConfig;
        }
    });

    const updatemutation = useMutation({
        mutationFn: async (newConfig: RulesNotifyConfig) => {
            await axios.put(`${API_BASE_URL}/rules-notify-manager`, newConfig);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rulesNotifyConfig'] });
            setNewItem(null);
        }
    });

    // Handle Add
    const handleAdd = () => {
        if (!config || !newItem || !newItem.id.trim()) return;

        const newConfig = JSON.parse(JSON.stringify(config)) as RulesNotifyConfig;
        const entry = { type: newItem.type, id: newItem.id.trim() };

        if (newItem.section === 'nextgen') {
            newConfig.nextgen_blacklist.push(entry);
        } else {
            newConfig.dedicated_whitelist.push(entry);
        }

        updatemutation.mutate(newConfig);
    };

    // Handle Delete
    const handleDelete = (section: 'nextgen' | 'dedicated', index: number) => {
        if (!config) return;
        const newConfig = JSON.parse(JSON.stringify(config)) as RulesNotifyConfig;

        if (section === 'nextgen') {
            newConfig.nextgen_blacklist.splice(index, 1);
        } else {
            newConfig.dedicated_whitelist.splice(index, 1);
        }

        updatemutation.mutate(newConfig);
    };

    if (isLoading) return <div className="p-12 text-center animate-pulse">Loading rules configuration...</div>;
    if (error) return <div className="p-12 text-center text-red-500">Error loading configuration: {(error as Error).message}</div>;
    if (!config) return null;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* NextGen Blacklist Section */}
                <div className="space-y-4">
                    <div className="bg-red-50 border border-red-100 rounded-xl p-6">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 bg-red-100 rounded-lg">
                                <ShieldAlert className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-red-900 border-b border-red-200/50 pb-2 mb-1 w-full">Nextgen Blacklist</h3>
                                <p className="text-sm text-red-700">
                                    Configure tenants or clusters to exclude from Nextgen alert processing.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {config.nextgen_blacklist.map((entry, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-red-100 shadow-sm group hover:border-red-300 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className={clsx(
                                            "text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide",
                                            entry.type === 'tenant' ? "bg-gray-100 text-gray-600" : "bg-purple-100 text-purple-600"
                                        )}>
                                            {entry.type}
                                        </span>
                                        <code className="text-sm font-mono text-gray-800">{entry.id}</code>
                                    </div>
                                    <button
                                        onClick={() => handleDelete('nextgen', idx)}
                                        className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                        title="Remove rule"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}

                            {config.nextgen_blacklist.length === 0 && (
                                <div className="text-center py-6 text-sm text-red-400 italic">
                                    No active blacklist rules.
                                </div>
                            )}

                            {newItem?.section === 'nextgen' ? (
                                <div className="bg-white p-3 rounded-lg border border-red-300 shadow-sm animate-in zoom-in-95 duration-200">
                                    <div className="flex gap-2 mb-2">
                                        <select
                                            className="px-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500/20"
                                            value={newItem.type}
                                            onChange={e => setNewItem({ ...newItem, type: e.target.value as any })}
                                        >
                                            <option value="tenant">Tenant ID</option>
                                            <option value="cluster">Cluster ID</option>
                                        </select>
                                        <input
                                            type="text"
                                            className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500/20"
                                            placeholder={`Enter ${newItem.type} ID...`}
                                            value={newItem.id}
                                            onChange={e => setNewItem({ ...newItem, id: e.target.value })}
                                            autoFocus
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleAdd();
                                                if (e.key === 'Escape') setNewItem(null);
                                            }}
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2 text-xs">
                                        <button onClick={() => setNewItem(null)} className="px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">Cancel</button>
                                        <button onClick={handleAdd} className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 font-medium">Add Rule</button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setNewItem({ section: 'nextgen', type: 'tenant', id: '' })}
                                    className="w-full py-2 border border-dashed border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 hover:border-red-400 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> Add Blacklist Rule
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Dedicated Whitelist Section */}
                <div className="space-y-4">
                    <div className="bg-green-50 border border-green-100 rounded-xl p-6">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 bg-green-100 rounded-lg">
                                <ShieldCheck className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-green-900 border-b border-green-200/50 pb-2 mb-1 w-full">Dedicated Whitelist</h3>
                                <p className="text-sm text-green-700">
                                    Configure specific tenants or clusters to allow for Dedicated environment.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {config.dedicated_whitelist.map((entry, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-green-100 shadow-sm group hover:border-green-300 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className={clsx(
                                            "text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide",
                                            entry.type === 'tenant' ? "bg-gray-100 text-gray-600" : "bg-purple-100 text-purple-600"
                                        )}>
                                            {entry.type}
                                        </span>
                                        <code className="text-sm font-mono text-gray-800">{entry.id}</code>
                                    </div>
                                    <button
                                        onClick={() => handleDelete('dedicated', idx)}
                                        className="p-1.5 text-green-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                        title="Remove rule"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}

                            {config.dedicated_whitelist.length === 0 && (
                                <div className="text-center py-6 text-sm text-green-600/70 italic">
                                    No active whitelist rules (All allowed? Or Deny all?).
                                </div>
                            )}

                            {newItem?.section === 'dedicated' ? (
                                <div className="bg-white p-3 rounded-lg border border-green-300 shadow-sm animate-in zoom-in-95 duration-200">
                                    <div className="flex gap-2 mb-2">
                                        <select
                                            className="px-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                            value={newItem.type}
                                            onChange={e => setNewItem({ ...newItem, type: e.target.value as any })}
                                        >
                                            <option value="tenant">Tenant ID</option>
                                            <option value="cluster">Cluster ID</option>
                                        </select>
                                        <input
                                            type="text"
                                            className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                            placeholder={`Enter ${newItem.type} ID...`}
                                            value={newItem.id}
                                            onChange={e => setNewItem({ ...newItem, id: e.target.value })}
                                            autoFocus
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleAdd();
                                                if (e.key === 'Escape') setNewItem(null);
                                            }}
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2 text-xs">
                                        <button onClick={() => setNewItem(null)} className="px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">Cancel</button>
                                        <button onClick={handleAdd} className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 font-medium">Add Rule</button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setNewItem({ section: 'dedicated', type: 'tenant', id: '' })}
                                    className="w-full py-2 border border-dashed border-green-300 text-green-600 rounded-lg text-sm font-medium hover:bg-green-50 hover:border-green-400 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> Add Whitelist Rule
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
