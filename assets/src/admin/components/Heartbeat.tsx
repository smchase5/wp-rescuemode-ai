import React from 'react';
import { motion } from 'framer-motion';

interface HeartbeatProps {
    status: 'healthy' | 'warning' | 'critical';
}

const Heartbeat: React.FC<HeartbeatProps> = ({ status }) => {
    const colors = {
        healthy: 'bg-green-500',
        warning: 'bg-orange-500',
        critical: 'bg-red-500',
    };

    const glowColors = {
        healthy: 'shadow-green-500/50',
        warning: 'shadow-orange-500/50',
        critical: 'shadow-red-500/50',
    };

    const color = colors[status];
    const glow = glowColors[status];

    return (
        <div className="relative flex items-center justify-center w-64 h-64">
            {/* Outer Ripple */}
            <motion.div
                className={`absolute w-full h-full rounded-full ${color} opacity-20`}
                animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            />

            {/* Inner Ripple */}
            <motion.div
                className={`absolute w-3/4 h-3/4 rounded-full ${color} opacity-20`}
                animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
            />

            {/* Core */}
            <div className={`relative z-10 w-32 h-32 rounded-full ${color} shadow-2xl ${glow} flex items-center justify-center`}>
                <motion.div
                    animate={{ scale: [1, 0.95, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="text-white font-bold text-xl"
                >
                    {status === 'healthy' ? 'OK' : 'FIX'}
                </motion.div>
            </div>
        </div>
    );
};

export default Heartbeat;
