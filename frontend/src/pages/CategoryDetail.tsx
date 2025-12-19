import { useState, useEffect } from 'react';
import axios from 'axios';
import { clsx } from 'clsx';
import { ComponentDetail } from './ComponentDetail';
import { AlertsDashboard } from './AlertsDashboard';
import { API_BASE_URL } from '../config/api';

interface Component {
    id: string;
    name: string;
    category: string;
    status: string;
}

interface CategoryDetailProps {
    categoryName: string;
}

export const CategoryDetail = ({ categoryName }: CategoryDetailProps) => {
    const [components, setComponents] = useState<Component[]>([]);
    const [selectedComponent, setSelectedComponent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'rules' | 'oncall'>('dashboard');

    useEffect(() => {
        const fetchComponents = async () => {
            try {
                setLoading(true);
                const res = await axios.get(`${API_BASE_URL}/components`);
                const allComps = res.data as Component[];
                const catComps = allComps.filter(c => c.category === categoryName);

                setComponents(catComps);
                if (catComps.length > 0) {
                    setSelectedComponent(catComps[0].name);
                }
            } catch (err) {
                console.error("Failed to fetch components", err);
            } finally {
                setLoading(false);
            }
        };

        fetchComponents();
    }, [categoryName]);

    if (loading) return <div className="p-12 text-center animate-pulse">Loading category...</div>;

    if (components.length === 0) {
        return (
            <div className="p-12 text-center">
                <h2 className="text-xl font-bold text-gray-900">{categoryName}</h2>
                <p className="text-gray-500 mt-2">No components found in this category.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-1 pb-4 border-b border-gray-200">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">{categoryName}</h1>
                <p className="text-sm text-gray-500">Category Overview & Components</p>
            </div>

            {/* Top Level Tabs */}
            <div className="border-b border-gray-200">
                <div className="flex gap-8">
                    <button onClick={() => setActiveTab('dashboard')} className={clsx("pb-3 px-1 text-base font-semibold border-b-2 transition-colors", activeTab === 'dashboard' ? "border-blue-600 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300")}>Alerts Dashboard</button>
                    <button onClick={() => setActiveTab('rules')} className={clsx("pb-3 px-1 text-base font-semibold border-b-2 transition-colors", activeTab === 'rules' ? "border-blue-600 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300")}>RulesManager</button>
                    <button onClick={() => setActiveTab('oncall')} className={clsx("pb-3 px-1 text-base font-semibold border-b-2 transition-colors", activeTab === 'oncall' ? "border-blue-600 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300")}>Oncall Dashboard</button>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'dashboard' && (
                <AlertsDashboard
                    components={components}
                    selectedComponent={selectedComponent}
                    onSelectComponent={setSelectedComponent}
                />
            )}

            {activeTab === 'rules' && (
                <div className="flex-1 overflow-y-auto">
                    {selectedComponent ? (
                        <ComponentDetail key={categoryName} componentName={categoryName} hideNavigation viewMode="rules" />
                    ) : (
                        <div className="p-12 text-center text-muted-foreground">Select a component in Alerts Dashboard to view rules.</div>
                    )}
                </div>
            )}

            {activeTab === 'oncall' && (
                <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl bg-white/50">
                    Oncall Dashboard content coming soon...
                </div>
            )}
        </div>
    );
};
