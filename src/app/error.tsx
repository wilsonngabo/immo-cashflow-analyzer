'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        fetch('/api/logError', {
            method: 'POST',
            body: JSON.stringify({ message: error.message, stack: error.stack }),
        });
    }, [error]);

    return (
        <div style={{ padding: '20px', color: 'red' }}>
            <h2>Application Error Captured</h2>
            <pre>{error.message}</pre>
        </div>
    );
}
