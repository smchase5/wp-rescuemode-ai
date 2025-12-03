import React from 'react';
import { Save } from 'lucide-react';

const Settings = () => {
    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-2">Configure your AI connection.</p>
            </div>

            <div className="grid gap-6">

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
