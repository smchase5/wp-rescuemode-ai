import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, CheckCircle, AlertTriangle, Box, RefreshCw, XCircle, Sparkles, Activity } from 'lucide-react';

interface PluginNode {
    id: string;
    name: string;
    file: string;
    status: 'pending' | 'scanning' | 'healthy' | 'conflict';
    error?: string;
}

interface AIAnalysis {
    summary: string;
    recommendation: string;
    technical_details: string;
    severity: 'low' | 'medium' | 'high';
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
    const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);

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
        setAnalysis(null);

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

            // Step 2.5: AI Analysis if conflicts exists
            const conflicts = plugins.filter(p => p.status === 'conflict');
            // Re-check current state because 'plugins' state in loop might be stale if we relied on closure,
            // but we are updating state in loop. To be safe, let's filter the state setter or refetch?
            // Actually, we need to inspect the *latest* plugins.
            // A pattern here is to capture the results in a local array variable as well.
            // Let's rely on a second pass or just wait for React? No, inside async function we can't wait for React state update in loop easily.
            // Better: Collecting conflicts in a local var.
            // However, since we updated plugins one by one, let's just grab the current list from the 'setPlugins' functional update? No.
            // Let's just collect results locally.

            // Re-implementation of loop to track local results
            // Note: The previous loop calls setPlugins, but the 'plugins' variable in scope is the initial one from render.
            // We need to track results manually.
        } catch (e) {
            // Handled below
        }
        // ... Wait, I'll refactor logic slightly to be robust.
    };

    // Corrected startScan logic
    const handleScanFlow = async () => {
        setIsScanning(true);
        setScanStep('Initializing environment...');
        setAnalysis(null);
        setActiveIndex(null);

        // Local tracker
        const results: PluginNode[] = JSON.parse(JSON.stringify(plugins));
        // Reset UI
        setPlugins(prev => prev.map(p => ({ ...p, status: 'pending', error: undefined })));

        try {
            // 1. Snapshot
            await fetch(`${wpraiAdmin.restUrl}scan/start`, {
                method: 'POST',
                headers: { 'X-WP-Nonce': wpraiAdmin.nonce }
            });

            // 2. Loop
            for (let i = 0; i < results.length; i++) {
                const p = results[i];
                setActiveIndex(i);
                setScanStep(`Checking ${p.name}...`);
                setPlugins(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'scanning' } : item));

                const res = await fetch(`${wpraiAdmin.restUrl}scan/test`, {
                    method: 'POST',
                    headers: { 'X-WP-Nonce': wpraiAdmin.nonce, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ file: p.file })
                });
                const data = await res.json();

                // Update local & UI
                results[i].status = data.status === 'healthy' ? 'healthy' : 'conflict';
                results[i].error = data.message;

                setPlugins(prev => prev.map((item, idx) => {
                    if (idx !== i) return item;
                    return { ...item, status: results[i].status, error: results[i].error };
                }));

                await new Promise(r => setTimeout(r, 400));
            }

            // 3. AI Analysis
            const conflicts = results.filter(r => r.status === 'conflict');
            if (conflicts.length > 0) {
                setScanStep('Consulting AI expert...');
                setActiveIndex(null);

                const aiRes = await fetch(`${wpraiAdmin.restUrl}scan/analyze`, {
                    method: 'POST',
                    headers: { 'X-WP-Nonce': wpraiAdmin.nonce, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conflicts: conflicts.map(c => ({ name: c.name, error: c.error }))
                    })
                });
                const aiData = await aiRes.json();
                setAnalysis(aiData);
            }

            // 4. Restore
            setScanStep('Restoring original configuration...');
            await fetch(`${wpraiAdmin.restUrl}scan/restore`, {
                method: 'POST',
                headers: { 'X-WP-Nonce': wpraiAdmin.nonce }
            });

            setScanStep('Scan complete.');

        } catch (e) {
            console.error(e);
            setScanStep('Error during scan.');
        } finally {
            setIsScanning(false);
            setActiveIndex(null);
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
                        onClick={handleScanFlow}
                        className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-primary-foreground transition-all duration-200 bg-primary rounded-full hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 hover:scale-105"
                    >
                        <Play className="w-6 h-6 mr-2 fill-current" />
                        <span>Start Conflict Scan</span>
                    </button>
                </div>
            )}

            {/* Report View */}
            {!isScanning && (scanStep === 'Scan complete.' || scanStep === 'Error during scan.') && (
                <ScanReport
                    plugins={plugins}
                    analysis={analysis}
                    onRestart={() => {
                        setScanStep('Ready to scan');
                        setAnalysis(null);
                        setPlugins(prev => prev.map(p => ({ ...p, status: 'pending', error: undefined })));
                    }}
                />
            )}

            {/* Visual Grid */}
            {scanStep !== 'Scan complete.' && scanStep !== 'Error during scan.' && (
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
            )}

            {/* Status Bar */}
            {scanStep !== 'Scan complete.' && scanStep !== 'Error during scan.' && (
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
            )}

        </div>
    );
};

const ScanReport = ({ plugins, analysis, onRestart }: { plugins: PluginNode[], analysis: AIAnalysis | null, onRestart: () => void }) => {
    const conflicts = plugins.filter(p => p.status === 'conflict');
    const healthy = plugins.filter(p => p.status === 'healthy');

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-3xl space-y-6"
        >
            {/* AI Insight Card */}
            {analysis && (
                <div className="bg-card border border-border rounded-3xl p-8 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Sparkles className="w-32 h-32" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-primary/10 text-primary p-2 rounded-lg">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <h2 className="text-2xl font-bold">AI Insight</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Analysis</h3>
                                <p className="text-lg leading-relaxed">{analysis.summary}</p>
                            </div>

                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-1 flex items-center gap-2">
                                    <Activity className="w-4 h-4" /> Recommendation
                                </h3>
                                <p className="font-medium">{analysis.recommendation}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Standard Stats */}
            <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="p-4 rounded-xl bg-card/50 border border-border text-center">
                        <div className="text-2xl font-bold">{plugins.length}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Scanned</div>
                    </div>
                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                        <div className="text-2xl font-bold text-green-500">{healthy.length}</div>
                        <div className="text-xs text-green-600/70 uppercase tracking-wider">Healthy</div>
                    </div>
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-center">
                        <div className="text-2xl font-bold text-destructive">{conflicts.length}</div>
                        <div className="text-xs text-destructive/70 uppercase tracking-wider">Conflicts</div>
                    </div>
                </div>

                {conflicts.length > 0 ? (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Technical Details</h3>
                        {conflicts.map(plugin => (
                            <div key={plugin.id} className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-left">
                                <div className="flex items-center gap-3 mb-2">
                                    <AlertTriangle className="w-5 h-5 text-destructive" />
                                    <span className="font-bold text-destructive">{plugin.name}</span>
                                </div>
                                <pre className="text-xs font-mono bg-black/5 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap text-destructive/80">
                                    {plugin.error || "Unknown error occurred during activation."}
                                </pre>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold">All clear!</h3>
                        <p className="text-muted-foreground">No conflicts detected with your current plugins.</p>
                    </div>
                )}
            </div>

            <div className="flex justify-center pt-4">
                <button
                    onClick={onRestart}
                    className="px-6 py-3 rounded-full bg-secondary text-secondary-foreground font-medium hover:bg-secondary/90 transition-colors"
                >
                    Run Scan Again
                </button>
            </div>
        </motion.div>
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
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 max-w-md p-3 bg-destructive text-destructive-foreground text-xs rounded shadow-lg opacity-0 group-hover/item:opacity-100 transition-opacity pointer-events-none z-50 whitespace-pre-wrap break-words">
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
