import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, CheckCircle, AlertTriangle, Box, RefreshCw, XCircle, Sparkles, Activity } from 'lucide-react';

export interface PluginNode {
    id: string;
    name: string;
    file: string;
    status: 'pending' | 'scanning' | 'healthy' | 'conflict';
    error?: string;
}

export interface AIAnalysis {
    summary: string;
    recommendation: string;
    technical_details: string;
    severity: 'low' | 'medium' | 'high';
}

interface ConflictScannerProps {
    apiBase: string; // e.g. /wp-json/wp-rescuemode/v1/ or configured endpoint
    authHeaders: Record<string, string>; // e.g. { 'X-WP-Nonce': ... } or { 'Content-Type': ... }
    onExit: () => void;
    mode?: 'admin' | 'rescue';
}

const ConflictScanner = ({ apiBase, authHeaders, onExit, mode = 'admin' }: ConflictScannerProps) => {
    const [isScanning, setIsScanning] = useState(false);
    const [plugins, setPlugins] = useState<PluginNode[]>([]);
    const [scanStep, setScanStep] = useState<string>('Ready to scan');
    const [isLoading, setIsLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
    const [scannedCount, setScannedCount] = useState(0);

    const conflicts = plugins.filter(p => p.status === 'conflict');

    useEffect(() => {
        fetchPlugins();
    }, []);

    const fetchPlugins = async () => {
        try {
            const res = await fetch(`${apiBase}scan/plugins`, {
                headers: authHeaders
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

    const handleScanFlow = async () => {
        setIsScanning(true);
        setScanStep('Initializing environment...');
        setAnalysis(null);
        setActiveIndex(null);

        // Reset UI
        setPlugins(prev => prev.map(p => ({ ...p, status: 'pending', error: undefined })));

        try {
            // 1. Start Scan
            const startRes = await fetch(`${apiBase}scan/start?mode=${mode}`, {
                method: 'POST',
                headers: { ...authHeaders }
            });
            if (!startRes.ok) throw new Error('Failed to start scan');

            // 2. Loop
            const results = [...plugins];
            for (let i = 0; i < results.length; i++) {
                const p = results[i];
                setActiveIndex(i);
                setScanStep(`Checking plugin ${i + 1}/${results.length}...`);
                setScannedCount(i + 1); // Update counter

                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

                    const res = await fetch(`${apiBase}scan/test`, {
                        method: 'POST',
                        headers: { ...authHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ file: p.file, mode: mode }), // Pass mode here
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}`);
                    }

                    const data = await res.json();
                    results[i].status = data.status === 'healthy' ? 'healthy' : 'conflict';
                    results[i].error = data.message;

                    // Stop on first conflict
                    if (results[i].status === 'conflict') {
                        // Restore? Only if NOT virtual.
                        if (mode !== 'admin') {
                            setScanStep('Restoring healthy plugins...');

                            // RESTORE IMMEDIATELY (excluding the bad one)
                            try {
                                const badFile = results[i].file;
                                await fetch(`${apiBase}scan/restore`, {
                                    method: 'POST',
                                    headers: { ...authHeaders, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ exclude: [badFile] })
                                });
                            } catch (restoreErr) {
                                console.error('Failed to restore after conflict:', restoreErr);
                            }
                        }

                        setScanStep('Scan complete.');
                        setIsScanning(false);
                        // Update the plugin list one last time to show the conflict
                        setPlugins(prev => prev.map((item, idx) => {
                            if (idx !== i) return item;
                            return { ...item, status: results[i].status, error: results[i].error };
                        }));
                        return;
                    }

                } catch (err: any) {
                    results[i].status = 'conflict';
                    if (err.name === 'AbortError') {
                        results[i].error = "Plugin caused a timeout (possible infinite loop or hang).";
                    } else {
                        results[i].error = `Scan invalid: ${err.message}`;
                    }

                    // Stop on first conflict (even if it's an error)
                    if (mode !== 'admin') {
                        setScanStep('Restoring healthy plugins...');
                        try {
                            const badFile = results[i].file;
                            await fetch(`${apiBase}scan/restore`, {
                                method: 'POST',
                                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ exclude: [badFile] })
                            });
                        } catch (restoreErr) {
                            console.error('Failed to restore after conflict:', restoreErr);
                        }
                    }

                    setScanStep('Scan complete.');
                    setIsScanning(false);
                    // Update the plugin list one last time to show the conflict
                    setPlugins(prev => prev.map((item, idx) => {
                        if (idx !== i) return item;
                        return { ...item, status: results[i].status, error: results[i].error };
                    }));
                    return;
                }

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

                const aiRes = await fetch(`${apiBase}scan/analyze`, {
                    method: 'POST',
                    headers: { ...authHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conflicts: conflicts.map(c => ({ name: c.name, error: c.error }))
                    })
                });
                const aiData = await aiRes.json();
                setAnalysis(aiData);
            }

            // 4. Restore
            setScanStep('Restoring safe configuration...');
            // Automatically exclude conflicts to "fix" the site
            // reusing conflicts from above
            const conflictFiles = conflicts.map(c => c.file);

            await fetch(`${apiBase}scan/restore`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ exclude: conflictFiles })
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

    // Simplified Scanner UI


    return (
        <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto py-12">

            {/* Header */}
            <div className="text-center mb-12 space-y-2">
                <h1 className="text-4xl font-black tracking-tighter">
                    {isScanning
                        ? (mode === 'rescue' ? 'Analyzing System...' : 'Conflict Scan in Progress')
                        : (conflicts.length > 0 ? 'Conflict Detected' : 'Conflict Scanner')}
                </h1>
                <p className="text-xl text-muted-foreground max-w-lg mx-auto">
                    {isScanning
                        ? (mode === 'rescue' ? "Our AI agent is testing your plugins." : "Systematically activating plugins to isolate conflicts.")
                        : (conflicts.length > 0
                            ? "We found the plugin causing the crash."
                            : "AI will systematically toggle plugins to identify compatibility issues.")}
                </p>
                {onExit && !isScanning && conflicts.length === 0 && (
                    <button onClick={onExit} className="text-sm hover:underline text-muted-foreground mt-4">Exit Scanner</button>
                )}
            </div>

            {/* VISUALIZATION: Pulse (Rescue) vs Grid (Admin) */}
            {isScanning && mode === 'rescue' && (
                <div className="relative w-64 h-64 flex items-center justify-center mb-8">
                    <motion.div
                        className="absolute inset-0 border-4 border-primary/20 rounded-full"
                        animate={{ scale: [1, 2], opacity: [1, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    />
                    <motion.div
                        className="absolute inset-0 border-4 border-primary/20 rounded-full"
                        animate={{ scale: [1, 2], opacity: [1, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1 }}
                    />
                    <div className="relative z-10 bg-primary text-primary-foreground rounded-full w-24 h-24 flex items-center justify-center shadow-2xl shadow-primary/30">
                        <Activity className="w-10 h-10 animate-pulse" />
                    </div>
                    <div className="absolute -bottom-16 text-center w-full">
                        <div className="font-mono text-sm text-primary font-bold mb-1">{scannedCount} / {plugins.length} analyzed</div>
                        <div className="text-xs text-muted-foreground">{scanStep}</div>
                    </div>
                </div>
            )}

            {/* VISUALIZATION: Grid (Admin) */}
            {isScanning && mode === 'admin' && (
                <div className="relative w-full aspect-video bg-card/30 border border-border/50 rounded-3xl p-8 mb-8 overflow-hidden flex items-center justify-center">
                    <div className="grid grid-cols-4 gap-8 w-full max-w-2xl max-h-[400px] overflow-y-auto p-4">
                        <AnimatePresence>
                            {plugins.map((plugin, idx) => (
                                <PluginItem key={plugin.id} plugin={plugin} isActive={idx === activeIndex} />
                            ))}
                        </AnimatePresence>
                    </div>
                    {/* Scanning Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

                    <div className="absolute bottom-4 left-0 right-0 text-center">
                        <div className="font-mono text-sm font-bold bg-background/80 backdrop-blur px-3 py-1 rounded-full inline-block border border-border">
                            {scanStep}
                        </div>
                    </div>
                </div>
            )}


            {/* IDLE STATE: Start Button */}
            {!isScanning && scanStep === 'Ready to scan' && (
                <div className="mb-8 relative group">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <button
                        onClick={handleScanFlow}
                        className="relative px-12 py-6 text-xl font-bold text-primary-foreground transition-all duration-200 bg-primary rounded-full hover:scale-105 shadow-xl flex items-center gap-3"
                    >
                        <Play className="w-8 h-8 fill-current" />
                        <span>Start Diagnosis</span>
                    </button>
                    {mode === 'admin' && plugins.length > 0 && (
                        <div className="mt-8 grid grid-cols-4 gap-4 opacity-50 hover:opacity-100 transition-opacity">
                            {plugins.slice(0, 8).map(p => (
                                <div key={p.id} className="text-xs text-center border p-2 rounded truncate">{p.name}</div>
                            ))}
                            {plugins.length > 8 && <div className="text-xs flex items-center justify-center">+{plugins.length - 8} more</div>}
                        </div>
                    )}
                </div>
            )}

            {/* RESULTS STATE: Simplified Report */}
            {!isScanning && (scanStep === 'Scan complete.' || scanStep === 'Error during scan.') && (
                <div className="w-full max-w-2xl">
                    {conflicts.length > 0 ? (
                        <div className="bg-destructive/5 border border-destructive/20 rounded-3xl p-8 text-center space-y-6">
                            <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-10 h-10" />
                            </div>

                            <div>
                                <h3 className="text-lg font-medium text-muted-foreground uppercase tracking-widest mb-2">Culprit Identified</h3>
                                <h2 className="text-3xl font-black text-destructive break-words">{conflicts[0].name}</h2>
                            </div>

                            <div className="bg-background/50 rounded-xl p-4 border border-destructive/10 text-left text-sm font-mono text-muted-foreground overflow-x-auto">
                                {conflicts[0].error}
                            </div>

                            <p className="text-foreground/80 leading-relaxed">
                                This plugin is causing critical errors. We have kept it <strong>deactivated</strong> so your site can function.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                                <GenerateEmailButton apiBase={apiBase} authHeaders={authHeaders} conflicts={conflicts} />
                                <a
                                    href="/wp-admin/"
                                    className="inline-flex items-center h-12 px-8 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                                >
                                    Fix & Go to WP Admin
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-card border border-border rounded-3xl p-12 text-center space-y-6">
                            <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-bold">System Healthy</h2>
                            <p className="text-muted-foreground">We checked {plugins.length} plugins and found no conflicts.</p>
                            <button
                                onClick={onExit}
                                className="px-8 py-3 rounded-full bg-secondary text-secondary-foreground font-medium hover:bg-secondary/90"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};

const ScanReport = ({ plugins, analysis, onRestart, onExit, apiBase, authHeaders }: { plugins: PluginNode[], analysis: AIAnalysis | null, onRestart: () => void, onExit: () => void, apiBase: string, authHeaders: any }) => {
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
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                            <div>
                                <h3 className="font-bold text-green-600">Site Restored (Safe Mode)</h3>
                                <p className="text-sm text-green-700/80">Conflicting plugins have been automatically kept deactivated. Your site should be working.</p>
                            </div>
                        </div>

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

            {/* Actions */}
            {conflicts.length > 0 && (
                <div className="flex justify-center gap-4 pt-4">
                    <button
                        onClick={onRestart}
                        className="px-6 py-3 rounded-full bg-secondary text-secondary-foreground font-medium hover:bg-secondary/90 transition-colors"
                    >
                        Run Scan Again
                    </button>
                    <GenerateEmailButton apiBase={apiBase} authHeaders={authHeaders} conflicts={conflicts} />
                    {onExit && (
                        <button
                            onClick={onExit}
                            className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                        >
                            Fix & Go to WP Admin
                        </button>
                    )}
                </div>
            )}
            {conflicts.length === 0 && (
                <div className="flex justify-center gap-4 pt-4">
                    <button
                        onClick={onRestart}
                        className="px-6 py-3 rounded-full bg-secondary text-secondary-foreground font-medium hover:bg-secondary/90 transition-colors"
                    >
                        Run Scan Again
                    </button>
                    {onExit && (
                        <button onClick={onExit} className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
                            Exit to Admin
                        </button>
                    )}
                </div>
            )}
        </motion.div>
    );
};

const GenerateEmailButton = ({ apiBase, authHeaders, conflicts }: { apiBase: string, authHeaders: any, conflicts: PluginNode[] }) => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState<string | null>(null);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            // Note: apiBase usually ends in slash, e.g. .../v1/
            // Endpoint is registered as /generate-email relative to namespace
            // But we might need to check if apiBase calls conflict-scanner-endpoint or rescue-endpoint.
            // They share same namespace 'wp-rescuemode/v1'.

            // We need to pass 'issue'
            const issue = conflicts.map(c => `${c.name}: ${c.error}`).join('\n');

            const res = await fetch(`${apiBase}generate-email`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ issue })
            });
            const data = await res.json();
            if (data.email) {
                setEmail(data.email);
            }
        } catch (e) {
            console.error(e);
            setEmail("Error generating email. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (email) {
        return (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl p-6 relative">
                    <button
                        onClick={() => setEmail(null)}
                        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                    >
                        <XCircle className="w-6 h-6" />
                    </button>
                    <h3 className="text-xl font-bold mb-4">Draft Email to Developer</h3>
                    <textarea
                        readOnly
                        className="w-full h-64 bg-muted/50 border border-border rounded-lg p-4 font-mono text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
                        value={email}
                    />
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(email);
                                alert('Copied to clipboard!');
                            }}
                            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/90"
                        >
                            Copy to Clipboard
                        </button>
                        <button
                            onClick={() => setEmail(null)}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-3 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Writing...' : 'Draft Developer Email'}
        </button>
    );
}

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
