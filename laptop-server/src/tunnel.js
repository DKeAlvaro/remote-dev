import ngrok from '@ngrok/ngrok';

/**
 * Tunnel manager for exposing the local server to the internet
 */
export class TunnelManager {
    constructor(authToken) {
        this.authToken = authToken;
        this.tunnel = null;
        this.publicUrl = null;
    }

    /**
     * Start the ngrok tunnel
     * @param {number} port - Local port to expose
     * @returns {Promise<string>} - Public URL
     */
    async start(port) {
        if (this.tunnel) {
            return this.publicUrl;
        }

        try {
            // Configure ngrok with auth token
            const options = {
                addr: port,
                authtoken: this.authToken,
                proto: 'http'
            };

            // Use static domain if provided
            if (process.env.NGROK_DOMAIN) {
                options.domain = process.env.NGROK_DOMAIN;
            }

            this.tunnel = await ngrok.connect(options);

            this.publicUrl = this.tunnel.url();
            console.log(`\n🌐 Tunnel established!`);
            console.log(`📱 Public URL: ${this.publicUrl}`);
            console.log(`\nUse this URL in your web app to connect.\n`);

            return this.publicUrl;
        } catch (error) {
            console.error('Failed to start ngrok tunnel:', error.message);
            throw error;
        }
    }

    /**
     * Stop the tunnel
     */
    async stop() {
        if (this.tunnel) {
            await ngrok.disconnect();
            this.tunnel = null;
            this.publicUrl = null;
            console.log('Tunnel closed.');
        }
    }

    /**
     * Get the current public URL
     */
    getUrl() {
        return this.publicUrl;
    }
}
