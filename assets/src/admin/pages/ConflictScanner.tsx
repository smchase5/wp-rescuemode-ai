import React from 'react';
import ConflictScanner from '../../components/ConflictScanner';

declare const wpraiAdmin: {
    restUrl: string;
    nonce: string;
};

const ConflictScannerPage = () => {
    return (
        <ConflictScanner
            apiBase={wpraiAdmin.restUrl}
            authHeaders={{ 'X-WP-Nonce': wpraiAdmin.nonce }}
            onExit={() => { }}
        />
    );
};

export default ConflictScannerPage;
