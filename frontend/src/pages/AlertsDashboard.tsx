import { clsx } from 'clsx';
import { LayoutGrid } from 'lucide-react';
import { ComponentDetail } from './ComponentDetail';

interface Component {
    id: string;
    name: string;
    category: string;
    status: string;
}

interface AlertsDashboardProps {
    components: Component[];
    selectedComponent: string;
    onSelectComponent: (name: string) => void;
}

export const AlertsDashboard = ({ components, selectedComponent, onSelectComponent }: AlertsDashboardProps) => {
    return (
        <div className="flex flex-col flex-1 gap-6 overflow-hidden h-full">
            {/* Top Components List */}
            <div className="flex-shrink-0 flex flex-col gap-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                    Components
                </div>
                <div className="flex flex-wrap gap-2 pb-2">
                    {components.map(comp => (
                        <button
                            key={comp.name}
                            onClick={() => onSelectComponent(comp.name)}
                            className={clsx(
                                "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-full transition-all border",
                                selectedComponent === comp.name
                                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                            )}
                        >
                            <LayoutGrid className={clsx("w-3.5 h-3.5", selectedComponent === comp.name ? "text-blue-100" : "text-gray-400")} />
                            <span className="truncate max-w-[150px]">{comp.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto min-w-0">
                {selectedComponent ? (
                    <ComponentDetail
                        componentName={selectedComponent}
                        hideNavigation
                        viewMode="dashboard"
                    />
                ) : (
                    <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl h-full flex flex-col items-center justify-center">
                        <LayoutGrid className="w-12 h-12 mb-4 text-gray-300" />
                        <p>Select a component to view details</p>
                    </div>
                )}
            </div>
        </div>
    );
};
