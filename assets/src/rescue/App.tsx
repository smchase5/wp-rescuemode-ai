import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import "../styles/tailwind.css";

const RescueApp = () => {
    const [status, setStatus] = useState<'idle' | 'analyzing' | 'fixed' | 'error'>('idle');
    const [logs, setLogs] = useState<string[]>([]);
    const [diagnosis, setDiagnosis] = useState<any>(null);

    // Read config from DOM
    const root = document.getElementById('wprai-rescue-root');
    const endpoint = root?.dataset.endpoint || '';
    const token = root?.dataset.token || '';

    const runDiagnosis = async () => {
        setStatus('analyzing');
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const data = await res.json();

            if (data.success) {
                setDiagnosis(data.data);
                setStatus('fixed'); // Or 'review' if we want a step in between
            } else {
                setStatus('error');
            }
        } catch (e) {
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground font-sans flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />

            <div className="relative z-10 max-w-2xl w-full space-y-12 text-center">

                {/* Header */}
                <div className="space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 text-primary mb-4">
                        <Bot className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                        Rescue Mode
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-lg mx-auto">
                        AI is ready to diagnose your site and fix critical errors automatically.
                    </p>
                </div>

                {/* Action Area */}
                <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl">
                    {status === 'idle' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-center gap-4 text-amber-500 bg-amber-500/10 p-4 rounded-xl">
                                <AlertTriangle className="w-6 h-6" />
                                <span className="font-medium">Site is currently experiencing issues</span>
                            </div>

                            <button
                                onClick={runDiagnosis}
                                className="w-full py-4 text-xl font-bold text-white bg-primary rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-3 group"
                            >
                                <span>Start AI Diagnosis</span>
                                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    )}

                    {status === 'analyzing' && (
                        <div className="space-y-8 py-8">
                            <div className="relative w-24 h-24 mx-auto">
                                <motion.div
                                    className="absolute inset-0 border-4 border-primary/30 rounded-full"
                                    animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                                <motion.div
                                    className="absolute inset-0 border-t-4 border-primary rounded-full"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                />
                            </div>
                            <p className="text-xl font-medium animate-pulse">Reading debug logs...</p>
                        </div>
                    )}

                    {status === 'fixed' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-center w-16 h-16 bg-green-500/20 text-green-500 rounded-full mx-auto">
                                <CheckCircle className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold">Diagnosis Complete</h3>
                                <p className="text-muted-foreground mt-2">
                                    {diagnosis?.message || "We found and fixed the issue."}
                                </p>
                            </div>

                            {diagnosis?.suspected_plugins && (
                                <div className="bg-muted/50 p-4 rounded-xl text-left">
                                    <p className="text-sm font-medium text-muted-foreground mb-2">Culprit found:</p>
                                    <code className="block bg-black/20 p-2 rounded text-sm">
                                        {diagnosis.suspected_plugins[0]}
                                    </code>
                                </div>
                            )}

                            <button
                                onClick={() => window.location.reload()}
                                className="w-full py-3 font-medium bg-secondary hover:bg-secondary/80 rounded-xl transition-colors"
                            >
                                Reload Site
                            </button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="space-y-4">
                            <p className="text-red-500">Something went wrong connecting to the rescue server.</p>
                            <button onClick={() => setStatus('idle')} className="text-sm underline">Try again</button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default RescueApp;
