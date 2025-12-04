import React, { useState } from 'react';
import { Save, Copy, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

declare global {
    interface Window {
        wpraiAdmin: {
            restUrl: string;
            token: string;
            nonce: string;
            rescueUrl: string;
            wpVersion: string;
            phpVersion: string;
            debugLog: boolean;
        };
    }
}

const Settings = () => {
    const [rescueUrl, setRescueUrl] = useState(window.wpraiAdmin?.rescueUrl || '');
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

    const handleCopy = () => {
        navigator.clipboard.writeText(rescueUrl);
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 2000);
    };

    const handleRegenerate = async () => {
        if (!confirm('Are you sure? The old Rescue URL will stop working immediately.')) {
            return;
        }

        setIsRegenerating(true);
        try {
            const res = await fetch(`${window.wpraiAdmin.restUrl}regenerate-token`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': window.wpraiAdmin.nonce,
                    'Content-Type': 'application/json',
                },
            });
            const data = await res.json();

            if (data.status === 'ok') {
                setRescueUrl(data.url);
                // Update global just in case
                window.wpraiAdmin.rescueUrl = data.url;
                window.wpraiAdmin.token = data.token;
            } else {
                alert('Failed to regenerate token.');
            }
        } catch (e) {
            alert('Error connecting to server.');
        } finally {
            setIsRegenerating(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-2">Configure your AI connection and Rescue Mode.</p>
            </div>

            <div className="grid gap-6">

                {/* Rescue Mode Access */}
                <div className="bg-card border border-border rounded-2xl p-8 shadow-sm space-y-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                Rescue Mode Access
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Use this secret URL to access your site when it's broken.
                            </p>
                        </div>
                        <div className="bg-amber-500/10 text-amber-500 p-2 rounded-lg">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium">Rescue URL</label>
                        <div className="flex gap-2">
                            <input
                                readOnly
                                value={rescueUrl}
                                className="flex-1 h-10 rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground focus:outline-none"
                            />
                            <button
                                onClick={handleCopy}
                                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                            >
                                {copyStatus === 'copied' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Keep this URL safe. Anyone with this link can deactivate plugins on your site.
                        </p>
                    </div>

                    <div className="pt-4 border-t border-border">
                        <button
                            onClick={handleRegenerate}
                            disabled={isRegenerating}
                            className="text-sm text-red-500 hover:text-red-600 font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                            Regenerate Rescue Token
                        </button>
                    </div>
                </div>

                {/* API Configuration */}
                <div className="bg-card border border-border rounded-2xl p-8 shadow-sm space-y-6">
                    <h2 className="text-xl font-semibold">AI Configuration</h2>
                    <div className="space-y-2">
                        <label htmlFor="openai-key" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            OpenAI API Key
                        </label>
                        <input
                            id="openai-key"
                            type="password"
                            placeholder="sk-..."
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <p className="text-sm text-muted-foreground">
                            Your key is stored locally in your WordPress database. We never see it.
                        </p>
                    </div>
                </div>

                {/* General Settings */}
                <div className="bg-card border border-border rounded-2xl p-8 shadow-sm space-y-6">
                    <h2 className="text-xl font-semibold">Rescue Behavior</h2>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <label className="text-base font-medium">Auto-Activate Rescue Mode</label>
                            <p className="text-sm text-muted-foreground">Automatically switch to Rescue Mode when a critical error is detected.</p>
                        </div>
                        <input type="checkbox" className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary" defaultChecked />
                    </div>

                    <div className="border-t border-border pt-6 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <label className="text-base font-medium">Email Notifications</label>
                            <p className="text-sm text-muted-foreground">Send a report after every automatic diagnosis.</p>
                        </div>
                        <input type="checkbox" className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary" />
                    </div>
                    <div className="space-y-2 pt-2">
                        <label htmlFor="email" className="text-sm font-medium">Notification Email</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="admin@example.com"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                    </div>
                </div>

                <div className="flex justify-end">
                    <button className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 py-2">
                        <Save className="w-4 h-4 mr-2" />
                        Save All Settings
                    </button>
                </div>

            </div>
        </div>
    );
};

export default Settings;
