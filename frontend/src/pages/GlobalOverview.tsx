import { useState } from 'react';
import { clsx } from 'clsx';
import { GlobalDashboard } from '../components/GlobalDashboard';
import { RulesNotifyManager } from './RulesNotifyManager';

export const GlobalOverview = () => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'rules' | 'oncall'>('dashboard');

    return (
        <div className="space-y-6">
            {/* Header with Navigation */}
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Global Overview</h1>
                    <p className="text-gray-500 mt-1 text-sm">Global overview of alerts and rules</p>
                </div>

                <div className="border-b border-gray-200">
                    <div className="flex gap-8">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={clsx(
                                "pb-3 px-1 text-base font-semibold border-b-2 transition-colors",
                                activeTab === 'dashboard' ? "border-blue-600 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            )}
                        >
                            Alerts Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('oncall')}
                            className={clsx(
                                "pb-3 px-1 text-base font-semibold border-b-2 transition-colors",
                                activeTab === 'oncall' ? "border-blue-600 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            )}
                        >
                            Oncall Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('rules')}
                            className={clsx(
                                "pb-3 px-1 text-base font-semibold border-b-2 transition-colors",
                                activeTab === 'rules' ? "border-blue-600 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            )}
                        >
                            Rules Notify Manager
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'dashboard' && <GlobalDashboard />}
                {activeTab === 'rules' && <RulesNotifyManager />}
                {activeTab === 'oncall' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl bg-white/50">
                            Global Oncall Dashboard interface is under construction.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
