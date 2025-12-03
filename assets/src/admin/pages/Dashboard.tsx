import React from 'react';
import Heartbeat from '../components/Heartbeat';
import { ArrowRight } from 'lucide-react';

const Dashboard = () => {
    // Mock status for now
    const status = 'healthy';

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-12">
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold tracking-tight">System Status</h1>
                <p className="text-muted-foreground text-lg">Everything is running smoothly.</p>
            </div>

            <Heartbeat status={status} />

            <div className="flex flex-col items-center gap-4">
                <button className="group relative inline-flex items-center justify-center px-8 py-3 text-lg font-medium text-white transition-all duration-200 bg-primary rounded-full hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                    <span>Run Health Check</span>
                    <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                </button>
                <p className="text-sm text-muted-foreground">Last scan: 2 hours ago</p>
            </div>
        </div>
    );
};

export default Dashboard;
