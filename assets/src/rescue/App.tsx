import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, AlertTriangle, CheckCircle, ArrowRight, Mail, Copy, RefreshCw, XCircle } from 'lucide-react';
import "../styles/tailwind.css";

const RescueApp = () => {
    const [status, setStatus] = useState<'idle' | 'analyzing' | 'fixed' | 'error'>('idle');
    const [fixStatus, setFixStatus] = useState<'idle' | 'fixing' | 'fixed' | 'error'>('idle');
    const [emailStatus, setEmailStatus] = useState<'idle' | 'generating' | 'generated' | 'error'>('idle');
    const [diagnosis, setDiagnosis] = useState<any>(null);
    const [emailContent, setEmailContent] = useState<string>('');

    // Read config from DOM
    const root = document.getElementById('wprai-rescue-root');
    const endpoint = root?.dataset.endpoint || '';
    const emailEndpoint = root?.dataset.emailEndpoint || '';
    const token = root?.dataset.token || '';

    const runDiagnosis = async () => {
        setStatus('analyzing');
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const text = await res.text();
            try {
                const data = JSON.parse(text);
                if (data.success || data.status === 'ok') {
                    setDiagnosis(data);
                    setStatus('fixed');
                } else {
                    setStatus('error');
                    setDiagnosis({ error: data.message || 'Unknown server error' });
                }
            } catch (e) {
                console.error('JSON Parse Error:', e);
                setStatus('error');
                // Show the raw response to help debug
                setDiagnosis({ error: 'Invalid JSON response: ' + text.substring(0, 200) + '...' } as any);
            }
        } catch (e: any) {
            console.error(e);
            setStatus('error');
            const errorMsg = e.message || 'Unknown error';
            setDiagnosis({ error: errorMsg } as any);
        }
    };

    const applyFix = async () => {
        setFixStatus('fixing');
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, apply_fix: true })
            });
            const text = await res.text();
            try {
                const data = JSON.parse(text);
                if ((data.success || data.status === 'ok') && data.fix_applied) {
                    setFixStatus('fixed');
                    setDiagnosis({ ...diagnosis, fix_applied: true, actions: data.actions });
                } else {
                    setFixStatus('error');
                    console.error('Fix failed:', data);
                }
            } catch (jsonError) {
                console.error('JSON Parse Error:', jsonError, text);
                setFixStatus('error');
            }
        } catch (e) {
            setFixStatus('error');
        }
    };

    const generateEmail = async () => {
        setEmailStatus('generating');
        try {
            const res = await fetch(emailEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    context: 'rescue',
                    issue: diagnosis?.suspicions?.[0]?.slug || 'Unknown issue'
                })
            });
            const data = await res.json();

            if (data.status === 'ok') {
                setEmailContent(data.email);
                setEmailStatus('generated');
            } else {
                setEmailStatus('error');
            }
        } catch (e) {
            setEmailStatus('error');
        }
    };

    const copyEmail = () => {
        navigator.clipboard.writeText(emailContent);
    };

    const [showAdvanced, setShowAdvanced] = useState(false);

    return (
        <div className="min-h-screen bg-background text-foreground font-sans flex flex-col items-center justify-center p-4">
            <div className="max-w-xl w-full space-y-8">

                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 text-red-500 animate-pulse">
                        <AlertTriangle className="w-10 h-10" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight">
                        Rescue Mode Active
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Your site is experiencing issues. We can scan for conflicts and fix them automatically.
                    </p>
                </div>

                {/* Main Action Area */}
                <div className="bg-card border border-border rounded-2xl p-8 shadow-lg text-center space-y-8">

                    {status === 'idle' && (
                        <div className="space-y-6">
                            <button
                                onClick={runDiagnosis}
                                className="w-full py-6 text-2xl font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all shadow-xl shadow-red-600/20 flex items-center justify-center gap-3 group transform hover:scale-[1.02]"
                            >
                                <span>Scan for Conflicts</span>
                                <ArrowRight className="w-8 h-8 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <p className="text-sm text-muted-foreground">
                                This will analyze your debug logs and active plugins.
                            </p>
                        </div>
                    )}

                    {status === 'analyzing' && (
                        <div className="space-y-6 py-4">
                            <div className="relative w-24 h-24 mx-auto">
                                <motion.div
                                    className="absolute inset-0 border-4 border-red-500/30 rounded-full"
                                    animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                                <motion.div
                                    className="absolute inset-0 border-t-4 border-red-500 rounded-full"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-semibold">Analyzing System...</h3>
                                <p className="text-muted-foreground">Checking debug logs and plugin signatures.</p>
                            </div>
                        </div>
                    )}

                    {status === 'fixed' && (
                        <div className="space-y-6 text-left">
                            {diagnosis?.suspicions && diagnosis.suspicions.length > 0 ? (
                                <div className="space-y-6">
                                    <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-xl">
                                        <h3 className="text-lg font-bold text-red-600 flex items-center gap-2 mb-2">
                                            <AlertTriangle className="w-5 h-5" />
                                            Conflict Detected
                                        </h3>
                                        <p className="text-foreground font-medium text-lg mb-1">
                                            {diagnosis.suspicions[0].name || diagnosis.suspicions[0].slug}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {diagnosis.suspicions[0].reason}
                                        </p>
                                    </div>

                                    {fixStatus === 'idle' && !diagnosis.fix_applied && (
                                        <button
                                            onClick={applyFix}
                                            className="w-full py-4 text-lg font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                                        >
                                            <RefreshCw className="w-6 h-6" />
                                            Deactivate Plugin & Fix Site
                                        </button>
                                    )}

                                    {fixStatus === 'fixing' && (
                                        <div className="flex items-center justify-center gap-3 py-4 text-lg font-medium text-muted-foreground">
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                            >
                                                <RefreshCw className="w-6 h-6" />
                                            </motion.div>
                                            Deactivating plugin...
                                        </div>
                                    )}

                                    {(fixStatus === 'fixed' || diagnosis.fix_applied) && (
                                        <div className="space-y-4">
                                            <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-xl text-center">
                                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 text-green-600 mb-3">
                                                    <CheckCircle className="w-6 h-6" />
                                                </div>
                                                <h3 className="text-xl font-bold text-green-600 mb-2">Issue Resolved</h3>
                                                <p className="text-muted-foreground mb-6">
                                                    The conflicting plugin has been deactivated. Your site should be accessible now.
                                                </p>
                                                <button
                                                    onClick={() => window.location.href = '/wp-admin'}
                                                    className="w-full py-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-medium transition-colors"
                                                >
                                                    Go to WP Admin
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-xl text-center space-y-4">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 text-green-600">
                                        <CheckCircle className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-green-600">No Obvious Conflicts</h3>
                                    <p className="text-muted-foreground">
                                        We couldn't identify a specific plugin causing the crash. Check the logs below for more details.
                                    </p>
                                    <button
                                        onClick={() => setShowAdvanced(true)}
                                        className="text-primary font-medium hover:underline"
                                    >
                                        View Debug Logs
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="space-y-4">
                            <div className="text-red-500 font-medium">
                                {diagnosis?.error || "Connection failed. Please try again."}
                            </div>
                            <button onClick={() => setStatus('idle')} className="text-sm underline">Retry</button>
                        </div>
                    )}
                </div>

                {/* Advanced Toggle */}
                <div className="text-center">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
                    </button>
                </div>

                {/* Advanced Section */}
                {showAdvanced && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {/* Recent Errors Card */}
                        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 text-left">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                                Recent Errors
                            </h3>
                            <div className="bg-muted rounded-lg p-4 font-mono text-xs text-muted-foreground whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                                {diagnosis?.debug_log_tail && diagnosis.debug_log_tail.length > 0 ? (
                                    diagnosis.debug_log_tail.slice(-20).join('\n')
                                ) : (
                                    <span className="italic opacity-50">No logs available yet. Run diagnosis to fetch logs.</span>
                                )}
                            </div>
                        </div>

                        {/* Email Generator Card */}
                        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 text-left">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Mail className="w-5 h-5 text-primary" />
                                Developer Email
                            </h3>

                            {emailStatus === 'idle' && (
                                <button
                                    onClick={generateEmail}
                                    disabled={status !== 'fixed'}
                                    className="w-full h-10 bg-secondary hover:bg-secondary/80 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Generate Draft
                                </button>
                            )}

                            {emailStatus === 'generating' && (
                                <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Writing email...
                                </div>
                            )}

                            {emailStatus === 'generated' && (
                                <div className="space-y-3">
                                    <textarea
                                        className="w-full h-32 bg-muted border border-input rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                        value={emailContent}
                                        readOnly
                                    />
                                    <button
                                        onClick={copyEmail}
                                        className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Copy className="w-4 h-4" />
                                        Copy to Clipboard
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

            </div>
        </div>
    );
};

export default RescueApp;
