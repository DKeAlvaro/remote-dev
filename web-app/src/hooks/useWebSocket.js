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
    const reconnectTimeoutRef = useRef(null);
    const serverUrlRef = useRef(serverUrl);
    const secretRef = useRef(sharedSecret);

    // Keep refs up to date
    useEffect(() => {
        serverUrlRef.current = serverUrl;
        secretRef.current = sharedSecret;
    }, [serverUrl, sharedSecret]);

    // Connect to WebSocket server
    const connect = useCallback(() => {
        // Don't connect if already connected or connecting
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
            console.log('WebSocket already connected/connecting');
            return;
        }

        try {
            // Convert HTTP URL to WebSocket URL
            const wsUrl = serverUrlRef.current.replace(/^http/, 'ws');
            console.log('Connecting to WebSocket:', wsUrl);
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                setError(null);

                // Authenticate immediately
                ws.send(JSON.stringify({
                    type: 'auth',
                    payload: { secret: secretRef.current }
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    setLastMessage(message);

                    // Handle authentication response
                    if (message.type === 'auth_success') {
                        console.log('WebSocket authenticated');
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

            ws.onclose = (event) => {
                console.log('WebSocket disconnected', event.code, event.reason);
                setIsConnected(false);
                setIsAuthenticated(false);
                wsRef.current = null;

                // Reconnect after 2 seconds if not a clean close
                if (event.code !== 1000) {
                    console.log('Will reconnect in 2 seconds...');
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, 2000);
                }
            };

            ws.onerror = (event) => {
                console.error('WebSocket error:', event);
                setError('Connection failed. Make sure the laptop server is running.');
            };

        } catch (e) {
            console.error('Failed to create WebSocket:', e);
            setError(`Failed to connect: ${e.message}`);
        }
    }, []);

    // Disconnect
    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close(1000, 'User disconnect');
            wsRef.current = null;
        }
    }, []);

    // Send a message
    const send = useCallback((type, payload) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('Sending:', type, payload);
            wsRef.current.send(JSON.stringify({ type, payload }));
            return true;
        }
        console.log('Cannot send, WebSocket not open. State:', wsRef.current?.readyState);
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
            }, 120000); // 2 minute timeout

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
