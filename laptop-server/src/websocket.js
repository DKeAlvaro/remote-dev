import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

/**
 * WebSocket handler for real-time communication with the web app
 */
export class WebSocketHandler {
    constructor(server, sharedSecret, handlers) {
        this.wss = new WebSocketServer({ server });
        this.sharedSecret = sharedSecret;
        this.handlers = handlers;
        this.clients = new Map();

        this.setupConnectionHandling();
    }

    setupConnectionHandling() {
        this.wss.on('connection', (ws, req) => {
            const clientId = uuidv4();
            console.log(`New connection: ${clientId}`);

            // Client state
            const client = {
                id: clientId,
                ws,
                authenticated: false
            };
            this.clients.set(clientId, client);

            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    await this.handleMessage(client, message);
                } catch (error) {
                    this.send(ws, {
                        type: 'error',
                        message: 'Invalid message format',
                        error: error.message
                    });
                }
            });

            ws.on('close', () => {
                console.log(`Client disconnected: ${clientId}`);
                this.clients.delete(clientId);
            });

            ws.on('error', (error) => {
                console.error(`WebSocket error for ${clientId}:`, error);
            });

            // Send welcome message
            this.send(ws, {
                type: 'welcome',
                message: 'Connected to Remote Dev Server. Please authenticate.'
            });
        });
    }

    async handleMessage(client, message) {
        const { type, payload } = message;

        // Handle authentication
        if (type === 'auth') {
            if (payload?.secret === this.sharedSecret) {
                client.authenticated = true;
                this.send(client.ws, { type: 'auth_success' });
                console.log(`Client ${client.id} authenticated`);
            } else {
                this.send(client.ws, { type: 'auth_failed', message: 'Invalid secret' });
            }
            return;
        }

        // All other messages require authentication
        if (!client.authenticated) {
            this.send(client.ws, { type: 'error', message: 'Not authenticated' });
            return;
        }

        // Route to appropriate handler
        const handler = this.handlers[type];
        if (handler) {
            try {
                const result = await handler(payload, (progress) => {
                    this.send(client.ws, { type: 'progress', payload: progress });
                });
                this.send(client.ws, { type: `${type}_result`, payload: result });
            } catch (error) {
                this.send(client.ws, {
                    type: 'error',
                    message: `Handler error: ${error.message}`,
                    originalType: type
                });
            }
        } else {
            this.send(client.ws, { type: 'error', message: `Unknown message type: ${type}` });
        }
    }

    send(ws, data) {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    /**
     * Broadcast a message to all authenticated clients
     */
    broadcast(data) {
        for (const client of this.clients.values()) {
            if (client.authenticated) {
                this.send(client.ws, data);
            }
        }
    }
}
