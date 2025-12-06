import React, { useState, useEffect } from 'react';
import { Save, Copy, RefreshCw, AlertTriangle, CheckCircle, Lock, Cpu, Thermometer, Mail } from 'lucide-react';

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

interface SettingsData {
    openai_key: string;
    ai_model: string;
    ai_temperature: number;
    auto_activate: boolean;
    email_notifications: boolean;
    notification_email: string;
}

const Settings = () => {
    const [rescueUrl, setRescueUrl] = useState(window.wpraiAdmin?.rescueUrl || '');
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

    // Settings State
    const [settings, setSettings] = useState<SettingsData>({
        openai_key: '',
        ai_model: 'gpt-4o-mini',
        ai_temperature: 0.3,
        auto_activate: true,
        email_notifications: false,
        notification_email: '',
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch(`${window.wpraiAdmin.restUrl}settings`, {
                    headers: {
                        'X-WP-Nonce': window.wpraiAdmin.nonce,
                    },
                });
                if (res.ok) {
                    const data = await res.json();
                    setSettings(data);
                }
            } catch (e) {
                console.error('Failed to load settings', e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (field: keyof SettingsData, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleCopy = async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(rescueUrl);
            } else {
                // Fallback
                const textArea = document.createElement("textarea");
                textArea.value = rescueUrl;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                } finally {
                    document.body.removeChild(textArea);
                }
            }
            setCopyStatus('copied');
            setTimeout(() => setCopyStatus('idle'), 2000);
        } catch (e) {
            console.error('Copy failed', e);
        }
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

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`${window.wpraiAdmin.restUrl}settings`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': window.wpraiAdmin.nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(settings)
            });

            if (res.ok) {
                // Could act toast here
                alert('Settings saved successfully.');
            } else {
                alert('Failed to save settings.');
            }
        } catch (e) {
            alert('Error saving settings.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="mt-8 flex justify-center"><RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-12">
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
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Cpu className="w-5 h-5" />
                        AI Configuration
                    </h2>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="openai-key" className="text-sm font-medium leading-none flex items-center gap-2">
                                OpenAI API Key <Lock className="w-3 h-3 text-muted-foreground" />
                            </label>
                            <input
                                id="openai-key"
                                type="password"
                                value={settings.openai_key}
                                onChange={(e) => handleChange('openai_key', e.target.value)}
                                placeholder="sk-..."
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <p className="text-sm text-muted-foreground">
                                Leave blank to use the plugin's default key (if available). Your key overrides the default.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">Model</label>
                                <select
                                    value={settings.ai_model}
                                    onChange={(e) => handleChange('ai_model', e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <option value="gpt-4o">GPT-4o (Smartest)</option>
                                    <option value="gpt-4o-mini">GPT-4o Mini (Fastest)</option>
                                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none flex items-center gap-2">
                                    <Thermometer className="w-3 h-3" />
                                    Temperature: {settings.ai_temperature}
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={settings.ai_temperature}
                                    onChange={(e) => handleChange('ai_temperature', parseFloat(e.target.value))}
                                    className="w-full"
                                />
                                <p className="text-xs text-muted-foreground">Lower is more deterministic, higher is more creative.</p>
                            </div>
                        </div>
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
                        <input
                            type="checkbox"
                            checked={settings.auto_activate}
                            onChange={(e) => handleChange('auto_activate', e.target.checked)}
                            className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                    </div>

                    <div className="border-t border-border pt-6 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <label className="text-base font-medium flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                Email Notifications
                            </label>
                            <p className="text-sm text-muted-foreground">Send a report after every automatic diagnosis.</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.email_notifications}
                            onChange={(e) => handleChange('email_notifications', e.target.checked)}
                            className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                    </div>

                    {settings.email_notifications && (
                        <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                            <label htmlFor="email" className="text-sm font-medium">Notification Email</label>
                            <input
                                id="email"
                                type="email"
                                value={settings.notification_email}
                                onChange={(e) => handleChange('notification_email', e.target.value)}
                                placeholder="admin@example.com"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                        </div>
                    )}
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 py-2"
                    >
                        {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Save All Settings
                    </button>
                </div>

            </div>
        </div>
    );
};

export default Settings;
