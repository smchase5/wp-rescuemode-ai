import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, LifeBuoy, ShieldAlert, Activity } from 'lucide-react';
import ConflictScanner from '../components/ConflictScanner';
import "../styles/tailwind.css";

const root = document.getElementById('wprai-rescue-root');

export default function RescueApp() {
    const [status, setStatus] = useState<'idle' | 'scanning' | 'fixed'>('idle');

    // Config from DOM
    const apiBase = root?.dataset.apiBase || ''; // e.g. /wp-json/wp-rescuemode/v1/
    const token = root?.dataset.token || '';

    const handleExit = () => {
        // If fixed, user might want to go to admin
        if (status === 'fixed') {
            window.location.href = window.location.origin + '/wp-admin/';
        } else {
            setStatus('idle');
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
            {/* Background Effects */}
            <div className="fixed inset-0 bg-grid-white/[0.02] bg-[length:50px_50px] pointer-events-none" />
            <div className="fixed inset-0 bg-gradient-to-br from-background via-background/95 to-primary/5 pointer-events-none" />

            {/* Main Container */}
            <main className="relative min-h-screen flex flex-col items-center justify-center p-6">

                <AnimatePresence mode='wait'>

                    {/* IDLE STATE */}
                    {status === 'idle' && (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="w-full max-w-2xl text-center space-y-8"
                        >
                            <div className="relative inline-block">
                                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                                <Bot className="w-24 h-24 text-primary relative z-10 mx-auto" strokeWidth={1.5} />
                            </div>

                            <div className="space-y-4">
                                <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/50">
                                    Rescue Mode AI
                                </h1>
                                <p className="text-xl text-muted-foreground leading-relaxed max-w-lg mx-auto">
                                    Your site is experiencing technical difficulties. Our AI agent can interactively scan your plugins to identify and isolate conflicts.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                                <button
                                    onClick={() => setStatus('scanning')}
                                    className="h-14 px-8 rounded-full bg-primary text-primary-foreground font-bold text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/25 flex items-center gap-3"
                                >
                                    <ShieldAlert className="w-5 h-5" />
                                    Start AI Conflict Scan
                                </button>

                                <a
                                    href={window.location.origin + '/wp-login.php'}
                                    className="h-14 px-8 rounded-full bg-secondary text-secondary-foreground font-bold text-lg hover:bg-secondary/80 transition-all flex items-center gap-3"
                                >
                                    <LifeBuoy className="w-5 h-5" />
                                    Try Login
                                </a>
                            </div>

                            <p className="text-xs text-muted-foreground/50 pt-8">
                                Secure Token: <span className="font-mono">{token.substring(0, 8)}...</span>
                            </p>
                        </motion.div>
                    )}

                    {/* SCANNING STATE */}
                    {status === 'scanning' && (
                        <motion.div
                            key="scanning"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full"
                        >
                            <ConflictScanner
                                apiBase={apiBase}
                                authHeaders={{
                                    'X-Rescue-Token': token,
                                    'Content-Type': 'application/json'
                                }}
                                onExit={handleExit}
                                mode="rescue"
                            />
                        </motion.div>
                    )}

                </AnimatePresence>
            </main>
        </div>
    );
}
