import React, { useState } from 'react';
import { Search, Filter, Download, FileText, AlertCircle, Info, CheckCircle } from 'lucide-react';

interface LogEntry {
    id: string;
    timestamp: string;
    level: 'info' | 'warning' | 'error' | 'success';
    message: string;
    source: string;
}

const MOCK_LOGS: LogEntry[] = [
    { id: '1', timestamp: '2023-10-27 10:30:01', level: 'info', message: 'Rescue Mode plugin initialized.', source: 'System' },
    { id: '2', timestamp: '2023-10-27 10:30:05', level: 'info', message: 'Starting daily health check...', source: 'Cron' },
    { id: '3', timestamp: '2023-10-27 10:30:06', level: 'success', message: 'Database connection verified.', source: 'Health Check' },
    { id: '4', timestamp: '2023-10-27 10:30:08', level: 'warning', message: 'High memory usage detected (85MB).', source: 'Monitor' },
    { id: '5', timestamp: '2023-10-27 10:35:12', level: 'error', message: 'Failed to connect to OpenAI API: Timeout.', source: 'AI Client' },
    { id: '6', timestamp: '2023-10-27 10:35:15', level: 'info', message: 'Retrying connection...', source: 'AI Client' },
    { id: '7', timestamp: '2023-10-27 10:35:16', level: 'success', message: 'Connection established.', source: 'AI Client' },
    { id: '8', timestamp: '2023-10-27 11:00:00', level: 'info', message: 'Scheduled scan started.', source: 'Scanner' },
    { id: '9', timestamp: '2023-10-27 11:02:30', level: 'warning', message: 'Plugin "Old Plugin" is causing slow queries.', source: 'Scanner' },
    { id: '10', timestamp: '2023-10-27 11:05:00', level: 'success', message: 'Scan completed successfully.', source: 'Scanner' },
];

const Logs = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterLevel, setFilterLevel] = useState<string>('all');

    const filteredLogs = MOCK_LOGS.filter(log => {
        const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.source.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterLevel === 'all' || log.level === filterLevel;
        return matchesSearch && matchesFilter;
    });

    const getIcon = (level: string) => {
        switch (level) {
            case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
            default: return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    // Helper for icon since AlertTriangle is not imported but used in switch
    const AlertTriangle = ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-6 h-[calc(100vh-4rem)] flex flex-col">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
                    <p className="text-muted-foreground mt-1">View and analyze system events.</p>
                </div>
                <button className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                </button>
            </div>

            {/* Toolbar */}
            <div className="flex gap-4 items-center bg-card border border-border p-4 rounded-xl shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 border-l border-border pl-4">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <select
                        className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
                        value={filterLevel}
                        onChange={(e) => setFilterLevel(e.target.value)}
                    >
                        <option value="all">All Levels</option>
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                        <option value="success">Success</option>
                    </select>
                </div>
            </div>

            {/* Log Viewer */}
            <div className="flex-1 bg-black/90 rounded-xl border border-border/50 shadow-inner overflow-hidden flex flex-col font-mono text-sm">
                <div className="flex items-center px-6 py-3 border-b border-white/10 bg-white/5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="w-48">Timestamp</div>
                    <div className="w-24">Level</div>
                    <div className="w-32">Source</div>
                    <div className="flex-1">Message</div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredLogs.length > 0 ? (
                        filteredLogs.map((log) => (
                            <div key={log.id} className="flex items-center px-4 py-2 hover:bg-white/5 rounded-lg transition-colors group">
                                <div className="w-48 text-muted-foreground text-xs">{log.timestamp}</div>
                                <div className="w-24 flex items-center gap-2">
                                    {getIcon(log.level)}
                                    <span className={`uppercase text-xs font-bold
                    ${log.level === 'error' ? 'text-red-500' : ''}
                    ${log.level === 'warning' ? 'text-amber-500' : ''}
                    ${log.level === 'success' ? 'text-green-500' : ''}
                    ${log.level === 'info' ? 'text-blue-500' : ''}
                  `}>{log.level}</span>
                                </div>
                                <div className="w-32 text-muted-foreground">{log.source}</div>
                                <div className="flex-1 text-gray-300 group-hover:text-white transition-colors">{log.message}</div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <FileText className="w-12 h-12 mb-4 opacity-20" />
                            <p>No logs found matching your criteria.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Logs;
