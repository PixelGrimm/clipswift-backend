const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - MUST be defined before routes
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create promotion codes in Stripe (run once)
async function createPromotionCodes() {
    try {
        // Create coupons first
        const coupons = {
            'WELCOME10': { percent_off: 10, duration: 'once' },
            'LAUNCH20': { percent_off: 20, duration: 'once' },
            'SAVE50': { percent_off: 50, duration: 'once' },
            'FREETRIAL': { percent_off: 100, duration: 'repeating', duration_in_months: 1 },
            'FREE100': { percent_off: 100, duration: 'once' }
        };

        for (const [code, config] of Object.entries(coupons)) {
            try {
                // Create coupon
                const coupon = await stripe.coupons.create({
                    id: code,
                    percent_off: config.percent_off,
                    duration: config.duration,
                    duration_in_months: config.duration_in_months,
                    name: `${code} - ${config.percent_off}% off`
                });

                // Create promotion code
                await stripe.promotionCodes.create({
                    coupon: coupon.id,
                    code: code,
                    active: true
                });

                console.log(`Created promotion code: ${code}`);
            } catch (error) {
                if (error.code === 'resource_missing') {
                    console.log(`Coupon ${code} already exists`);
                } else {
                    console.error(`Error creating ${code}:`, error.message);
                }
            }
        }
    } catch (error) {
        console.error('Error creating promotion codes:', error);
    }
}

// Initialize promotion codes
createPromotionCodes();

// Endpoint to manually create/check promotion codes
app.get('/setup-promotion-codes', async (req, res) => {
    try {
        await createPromotionCodes();
        
        // Test if promotion codes are working
        const testSession = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: 'price_1RzIKIPu9zXPs9BWghmq5pRE',
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: 'https://clipswift-backend-production.up.railway.app/success',
            cancel_url: 'https://clipswift-backend-production.up.railway.app/cancel',
            allow_promotion_codes: true,
        });
        
        res.json({ 
            message: 'Promotion codes setup completed',
            codes: ['WELCOME10', 'LAUNCH20', 'SAVE50', 'FREETRIAL', 'FREE100'],
            testSessionUrl: testSession.url,
            promotionCodesEnabled: true
        });
    } catch (error) {
        console.error('Error setting up promotion codes:', error);
        res.status(500).json({ error: 'Failed to setup promotion codes', details: error.message });
    }
});

// Alternative endpoint to create checkout with explicit promotion code field
app.post('/create-checkout-with-promo', async (req, res) => {
    try {
        const { priceId, successUrl, cancelUrl, customerEmail } = req.body;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: customerEmail,
            allow_promotion_codes: true,
            billing_address_collection: 'auto',
            metadata: {
                source: 'clipswift_extension'
            },
            // Force enable promotion codes
            payment_method_collection: 'always',
            automatic_tax: { enabled: false }
        });

        res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Failed to create checkout session', details: error.message });
    }
});

// Serve static HTML files
app.get('/success', (req, res) => {
    res.sendFile(path.join(__dirname, 'success.html'));
});

app.get('/cancel', (req, res) => {
    res.sendFile(path.join(__dirname, 'cancel.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test endpoint to check if server is running
app.get('/', (req, res) => {
    res.json({ message: 'ClipSwift Backend is running!', timestamp: new Date().toISOString() });
});

// Create Stripe checkout session
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { priceId, successUrl, cancelUrl, customerEmail } = req.body;

        let sessionConfig = {
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: customerEmail,
            allow_promotion_codes: true, // Enable discount codes on Stripe checkout
            billing_address_collection: 'auto',
            metadata: {
                source: 'clipswift_extension'
            }
        };

        const session = await stripe.checkout.sessions.create(sessionConfig);

        res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// Verify payment status
app.post('/verify-payment', async (req, res) => {
    try {
        const { sessionId } = req.body;

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        
        if (session.payment_status === 'paid') {
            res.json({ paymentStatus: 'completed' });
        } else {
            res.json({ paymentStatus: 'pending' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
});

// Stripe webhook
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log('Payment completed for session:', session.id);
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
