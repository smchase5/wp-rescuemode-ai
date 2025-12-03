import React from 'react';
import { Activity, ShieldAlert, Settings, FileText } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
    activePage: string;
    onNavigate: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activePage, onNavigate }) => {
    return (
        <div className="min-h-screen bg-background text-foreground font-sans flex">
            {/* Minimal Sidebar */}
            <aside className="w-16 border-r border-border bg-card flex flex-col items-center py-6 gap-6">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                    <Activity className="text-primary-foreground w-6 h-6" />
                </div>

                <nav className="flex flex-col gap-4 mt-8 w-full px-2">
                    <NavItem icon={<Activity />} label="Dashboard" id="dashboard" active={activePage === 'dashboard'} onClick={() => onNavigate('dashboard')} />
                    <NavItem icon={<ShieldAlert />} label="Scanner" id="scanner" active={activePage === 'scanner'} onClick={() => onNavigate('scanner')} />
                    <NavItem icon={<FileText />} label="Logs" id="logs" active={activePage === 'logs'} onClick={() => onNavigate('logs')} />
                    <div className="flex-grow" />
                    <NavItem icon={<Settings />} label="Settings" id="settings" active={activePage === 'settings'} onClick={() => onNavigate('settings')} />
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 relative overflow-hidden">
                <div className="max-w-5xl mx-auto relative z-10">
                    {children}
                </div>

                {/* Background Ambient Glow */}
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            </main>
        </div>
    );
};

const NavItem = ({ icon, label, id, active, onClick }: { icon: React.ReactNode, label: string, id: string, active?: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`w-full aspect-square flex items-center justify-center rounded-lg transition-all duration-200 group relative
      ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
    `}
        title={label}
    >
        {React.cloneElement(icon as React.ReactElement, { size: 20 })}
        {active && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
        )}
    </button>
);

export default Layout;
