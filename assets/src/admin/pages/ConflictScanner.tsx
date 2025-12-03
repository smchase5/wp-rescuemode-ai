import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, CheckCircle, AlertTriangle, Box, RefreshCw, XCircle } from 'lucide-react';

interface PluginNode {
    id: string;
    name: string;
    file: string;
    status: 'pending' | 'scanning' | 'healthy' | 'conflict';
    error?: string;
}

declare const wpraiAdmin: {
    restUrl: string;
    nonce: string;
};

const ConflictScanner = () => {
    const [isScanning, setIsScanning] = useState(false);
    const [plugins, setPlugins] = useState<PluginNode[]>([]);
    const [scanStep, setScanStep] = useState<string>('Ready to scan');
    const [isLoading, setIsLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    useEffect(() => {
        fetchPlugins();
    }, []);

    const fetchPlugins = async () => {
        try {
            const res = await fetch(`${wpraiAdmin.restUrl}scan/plugins`, {
                headers: { 'X-WP-Nonce': wpraiAdmin.nonce }
            });
            const data = await res.json();
            if (Array.isArray(data)) {
                setPlugins(data);
            }
        } catch (e) {
            console.error('Failed to fetch plugins', e);
        } finally {
            setIsLoading(false);
        }
    };

    const startScan = async () => {
        setIsScanning(true);
        setScanStep('Initializing environment...');
        setActiveIndex(null);

        // Reset statuses
        setPlugins(prev => prev.map(p => ({ ...p, status: 'pending', error: undefined })));

        try {
            // Step 1: Start Scan (Snapshot & Deactivate)
            await fetch(`${wpraiAdmin.restUrl}scan/start`, {
                method: 'POST',
                headers: { 'X-WP-Nonce': wpraiAdmin.nonce }
            });

            // Step 2: Test each plugin
            for (let i = 0; i < plugins.length; i++) {
                const plugin = plugins[i];
                setActiveIndex(i);

                // Update UI to scanning
                setPlugins(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'scanning' } : p));
                setScanStep(`Checking ${plugin.name}...`);

                // Call API
                const res = await fetch(`${wpraiAdmin.restUrl}scan/test`, {
                    method: 'POST',
                    headers: {
                        'X-WP-Nonce': wpraiAdmin.nonce,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ file: plugin.file })
                });

                const result = await res.json();

                // Update UI result
                setPlugins(prev => prev.map((p, idx) => {
                    if (idx !== i) return p;
                    return {
                        ...p,
                        status: result.status === 'healthy' ? 'healthy' : 'conflict',
                        error: result.message
                    };
                }));

                // Small delay for visual pacing
                await new Promise(r => setTimeout(r, 500));
            }

            setActiveIndex(null);
            setScanStep('Restoring original configuration...');

            // Step 3: Restore
            await fetch(`${wpraiAdmin.restUrl}scan/restore`, {
                method: 'POST',
                headers: { 'X-WP-Nonce': wpraiAdmin.nonce }
            });

            setScanStep('Scan complete.');

        } catch (e) {
            console.error('Scan failed', e);
            setScanStep('Scan failed. Please check logs.');
            setActiveIndex(null);
        } finally {
            setIsScanning(false);
        }
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-4xl mx-auto">

            {/* Header */}
            <div className="text-center mb-12 space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Conflict Scanner</h1>
                <p className="text-muted-foreground">
                    AI will systematically toggle plugins to identify compatibility issues.
                </p>
            </div>

            {/* Actions */}
            {!isScanning && scanStep === 'Ready to scan' && (
                <div className="mb-8">
                    <button
                        onClick={startScan}
                        className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-primary-foreground transition-all duration-200 bg-primary rounded-full hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 hover:scale-105"
                    >
                        <Play className="w-6 h-6 mr-2 fill-current" />
                        <span>Start Conflict Scan</span>
                    </button>
                </div>
            )}

            {/* Visual Grid */}
            <div className="relative w-full aspect-video bg-card/30 border border-border/50 rounded-3xl p-8 mb-8 overflow-hidden flex items-center justify-center">
                <div className="grid grid-cols-4 gap-8 w-full max-w-2xl max-h-[400px] overflow-y-auto p-4">
                    <AnimatePresence>
                        {plugins.map((plugin, idx) => (
                            <PluginItem key={plugin.id} plugin={plugin} isActive={idx === activeIndex} />
                        ))}
                    </AnimatePresence>
                </div>

                {/* Scanning Overlay / Beam */}
                {isScanning && (
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />
                )}
            </div>

            {/* Status Bar */}
            <div className="w-full max-w-2xl bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    {isScanning ? (
                        <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                    ) : (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    <span className="font-medium font-mono text-sm">{scanStep}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                    {plugins.filter(p => p.status === 'healthy').length} / {plugins.length} Checked
                </div>
            </div>

        </div>
    );
};

const PluginItem = ({ plugin, isActive }: { plugin: PluginNode, isActive: boolean }) => {
    return (
        <motion.div
            layout
            className={`relative flex flex-col items-center justify-center p-4 rounded-xl border transition-colors duration-300 h-32 group/item
                ${plugin.status === 'pending' && !isActive ? 'border-border bg-card/50 text-muted-foreground' : ''}
                ${isActive ? 'border-primary text-primary z-10' : ''}
                ${plugin.status === 'healthy' && !isActive ? 'border-green-500/30 bg-green-500/5 text-green-500' : ''}
                ${plugin.status === 'conflict' && !isActive ? 'border-red-500 bg-red-500/10 text-red-500' : ''}
            `}
        >
            {plugin.status === 'conflict' ? (
                <div className="relative">
                    <AlertTriangle className="w-8 h-8 mb-2" />
                    {plugin.error && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-destructive text-destructive-foreground text-[10px] rounded shadow-lg opacity-0 group-hover/item:opacity-100 transition-opacity pointer-events-none z-10 whitespace-pre-wrap break-words">
                            {plugin.error}
                        </div>
                    )}
                </div>
            ) : (
                <Box className="w-8 h-8 mb-2" />
            )}

            <span className="text-xs font-medium text-center truncate w-full px-2" title={plugin.name}>
                {plugin.name}
            </span>

            {isActive && (
                <motion.div
                    className="absolute inset-0 border-2 border-primary bg-primary/5 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.2)]"
                    layoutId="scan-focus"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
            )}
        </motion.div>
    );
}

export default ConflictScanner;
