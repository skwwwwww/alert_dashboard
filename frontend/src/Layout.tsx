import { Sidebar } from './components/Sidebar';

export const Layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 text-foreground font-sans">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto h-full">
                <div className="max-w-7xl mx-auto pb-20">
                    {children}
                </div>
            </main>
        </div>
    );
};
