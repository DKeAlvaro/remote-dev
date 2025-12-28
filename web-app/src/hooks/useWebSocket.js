import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for WebSocket connection to laptop server
 */
export function useWebSocket(serverUrl, sharedSecret) {
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);
    const [error, setError] = useState(null);

    const wsRef = useRef(null);
    const messageHandlersRef = useRef(new Map());

    // Connect to WebSocket server
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            // Convert HTTP URL to WebSocket URL
            const wsUrl = serverUrl.replace(/^http/, 'ws');
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                setError(null);

                // Authenticate immediately
                ws.send(JSON.stringify({
                    type: 'auth',
                    payload: { secret: sharedSecret }
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    setLastMessage(message);

                    // Handle authentication response
                    if (message.type === 'auth_success') {
                        setIsAuthenticated(true);
                    } else if (message.type === 'auth_failed') {
                        setError('Authentication failed. Check your shared secret.');
                        setIsAuthenticated(false);
                    }

                    // Call registered handlers
                    const handlers = messageHandlersRef.current.get(message.type) || [];
                    handlers.forEach(handler => handler(message.payload));

                    // Also call wildcard handlers
                    const wildcardHandlers = messageHandlersRef.current.get('*') || [];
                    wildcardHandlers.forEach(handler => handler(message));
                } catch (e) {
                    console.error('Failed to parse message:', e);
                }
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
                setIsAuthenticated(false);
                wsRef.current = null;
            };

            ws.onerror = (event) => {
                console.error('WebSocket error:', event);
                setError('Connection failed. Make sure the laptop server is running.');
            };

            wsRef.current = ws;
        } catch (e) {
            setError(`Failed to connect: ${e.message}`);
        }
    }, [serverUrl, sharedSecret]);

    // Disconnect
    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    // Send a message
    const send = useCallback((type, payload) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, payload }));
            return true;
        }
        return false;
    }, []);

    // Register a message handler
    const onMessage = useCallback((type, handler) => {
        if (!messageHandlersRef.current.has(type)) {
            messageHandlersRef.current.set(type, []);
        }
        messageHandlersRef.current.get(type).push(handler);

        // Return unsubscribe function
        return () => {
            const handlers = messageHandlersRef.current.get(type);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        };
    }, []);

    // Send a message and wait for response
    const request = useCallback((type, payload) => {
        return new Promise((resolve, reject) => {
            const responseType = `${type}_result`;
            const timeoutId = setTimeout(() => {
                reject(new Error('Request timeout'));
            }, 60000);

            const unsubscribe = onMessage(responseType, (result) => {
                clearTimeout(timeoutId);
                unsubscribe();
                resolve(result);
            });

            const errorUnsub = onMessage('error', (error) => {
                if (error.originalType === type) {
                    clearTimeout(timeoutId);
                    unsubscribe();
                    errorUnsub();
                    reject(new Error(error.message));
                }
            });

            if (!send(type, payload)) {
                clearTimeout(timeoutId);
                unsubscribe();
                errorUnsub();
                reject(new Error('Not connected'));
            }
        });
    }, [send, onMessage]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        isConnected,
        isAuthenticated,
        lastMessage,
        error,
        connect,
        disconnect,
        send,
        onMessage,
        request
    };
}
