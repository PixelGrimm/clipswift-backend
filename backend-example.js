const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: true, // Allow all origins for Chrome extensions
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Store payment sessions (in production, use a database)
const paymentSessions = new Map();

// Create Stripe checkout session
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { priceId, successUrl, cancelUrl, customerEmail } = req.body;

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId, // Your Stripe price ID for $7.99/month
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: customerEmail,
            metadata: {
                product: 'ClipSwift Premium',
                customerEmail: customerEmail,
            },
        });

        // Store session for verification
        paymentSessions.set(session.id, {
            status: 'pending',
            customerEmail: customerEmail,
            createdAt: new Date(),
        });

        res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// Verify payment status
app.post('/verify-payment', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }

        // Retrieve the session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            // Payment successful
            paymentSessions.set(sessionId, {
                status: 'completed',
                customerEmail: session.customer_email,
                completedAt: new Date(),
            });

            res.json({ paymentStatus: 'completed' });
        } else {
            // Payment failed or pending
            res.json({ paymentStatus: 'failed' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
});

// Webhook to handle Stripe events (for production)
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log('Payment successful for session:', session.id);
            
            // Update session status
            paymentSessions.set(session.id, {
                status: 'completed',
                customerEmail: session.customer_email,
                completedAt: new Date(),
            });
            break;
            
        case 'customer.subscription.created':
            const subscription = event.data.object;
            console.log('Subscription created:', subscription.id);
            break;
            
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
