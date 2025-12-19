import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { clsx } from 'clsx';
import { Home, ChevronRight, Settings, Activity } from 'lucide-react';

interface Component {
    id: string;
    name: string;
    category: string;
    status: string;
}

export const Sidebar = () => {
    const [components, setComponents] = useState<Component[]>([]);
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
    const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

    useEffect(() => {
        // In dev, use port 8080. In prod, this would be relative.
        const fetchData = async () => {
            try {
                // Fetch categories first to establish order
                const catRes = await axios.get(`${API_BASE_URL}/categories`);
                setCategoryOrder(catRes.data);

                const compRes = await axios.get(`${API_BASE_URL}/components`);
                const comps = compRes.data as Component[];
                setComponents(comps);

                // Default expand all categories
                const allCategories: Record<string, boolean> = {};
                comps.forEach(c => allCategories[c.category] = true);
                setOpenCategories(allCategories);
            } catch (err) {
                console.error("Failed to fetch sidebar data", err);
            }
        };
        fetchData();
    }, []);

    // Group by Category
    const grouped = components.reduce((acc, comp) => {
        const cat = comp.category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(comp);
        return acc;
    }, {} as Record<string, Component[]>);

    const toggleCategory = (cat: string) => {
        setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    const formatCategoryName = (name: string) => {
        return name
            .replace(/^Platform - /, '')
            .replace(/^Core - /, '')
    };

    return (
        // Sidebar: Deep Blue Background, White Text
        <div className="w-80 bg-[#0B1120] text-white border-r border-gray-800 h-screen flex flex-col shrink-0 transition-all duration-300">
            <div className="p-6 flex items-center gap-3 border-b border-gray-800">
                <div className="p-1.5 bg-blue-600 rounded-lg">
                    <Activity className="text-white w-5 h-5" />
                </div>
                <div>
                    <h1 className="font-bold text-base tracking-tight leading-none">OpsPlatform</h1>
                    <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">Monitor V2</span>
                </div>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
                {/* Global Dashboard */}
                <a href="/" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-white/10 text-gray-300 hover:text-white transition-colors">
                    <Home className="w-4 h-4" />
                    Overview
                </a>

                <div className="pt-4 pb-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Infrastructure
                </div>

                {/* Categories */}
                {categoryOrder.map(cat => {
                    if (!grouped[cat]) return null;
                    return (
                        <a
                            key={cat}
                            href={`/category/${encodeURIComponent(cat)}`}
                            className={clsx(
                                "flex items-center justify-between w-full px-3 py-1.5 text-sm font-medium rounded-md transition-colors group",
                                window.location.pathname.includes(`/category/${encodeURIComponent(cat)}`) ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" : "hover:bg-white/5 text-gray-400 hover:text-white"
                            )}
                        >
                            <div className="flex items-center gap-2 text-left">
                                <span className="truncate">{formatCategoryName(cat)}</span>
                            </div>

                        </a>
                    );
                })}

                {/* Render any unseen categories at the end */}
                {Object.keys(grouped).filter(c => !categoryOrder.includes(c)).map(cat => (
                    <div key={cat} className="space-y-1">
                        <button
                            onClick={() => toggleCategory(cat)}
                            className="flex items-center justify-between w-full px-3 py-1.5 text-sm font-medium rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors group"
                        >
                            <div className="flex items-center gap-2">
                                <span className={clsx("transition-transform duration-200", openCategories[cat] ? "rotate-90" : "")}>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                                {cat}
                            </div>

                        </button>

                        {openCategories[cat] && (
                            <div className="pl-9 space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                                {grouped[cat].map(comp => (
                                    <a
                                        key={comp.id}
                                        href={`/components/${comp.name}`}
                                        className="block px-2 py-1.5 text-sm text-gray-500 hover:text-white hover:bg-white/5 rounded-md transition-colors truncate"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="truncate">{comp.name}</span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            {/* Settings */}
            <div className="p-3">
                <a href="/settings" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-white/10 text-gray-300 hover:text-white transition-colors">
                    <Settings className="w-4 h-4" />
                    Settings
                </a>
            </div>

            <div className="p-4 border-t border-gray-800 bg-[#050914]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white ring-2 ring-gray-800">
                        U
                    </div>
                    <div className="text-sm">
                        <p className="font-medium text-white">User</p>
                        <p className="text-xs text-gray-400">Administrator</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
