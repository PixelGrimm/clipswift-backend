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
        console.log('Starting promotion codes setup...');
        
        // Check if Stripe key is valid
        if (!process.env.STRIPE_SECRET_KEY) {
            console.error('STRIPE_SECRET_KEY not found in environment variables');
            return;
        }

        // Create coupons first
        const coupons = {
            'WELCOME10': { percent_off: 10, duration: 'once' },
            'LAUNCH20': { percent_off: 20, duration: 'once' },
            'SAVE50': { percent_off: 50, duration: 'once' },
            'FREETRIAL': { percent_off: 99, duration: 'repeating', duration_in_months: 1 }, // 99% off for 1 month (£0.08), then full price
            'FREE100': { percent_off: 100, duration: 'once' } // 100% off forever (one-time)
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
                if (error.code === 'resource_missing' || error.code === 'resource_already_exists') {
                    console.log(`Coupon ${code} already exists or is being created`);
                } else {
                    console.error(`Error creating ${code}:`, error.message);
                }
            }
        }
        console.log('Promotion codes setup completed');
    } catch (error) {
        console.error('Error creating promotion codes:', error);
        // Don't crash the server if promotion codes fail
    }
}

// Initialize promotion codes with delay to avoid startup issues
setTimeout(() => {
    createPromotionCodes();
}, 5000); // Wait 5 seconds after server starts

// Endpoint to manually create/check promotion codes
app.get('/setup-promotion-codes', async (req, res) => {
    try {
        await createPromotionCodes();
        
        // Test if promotion codes are working
        const testSession = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: 'price_1RzQRWLRp5AeS8F20zehtEpk', // Live price ID
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

// Force recreate promotion codes (useful for updating existing codes)
app.get('/recreate-promotion-codes', async (req, res) => {
    try {
        console.log('🔄 Force recreating promotion codes...');
        
        // Delete existing promotion codes first
        const existingCodes = ['WELCOME10', 'LAUNCH20', 'SAVE50', 'FREETRIAL', 'FREE100'];
        
        for (const code of existingCodes) {
            try {
                // Delete promotion code
                const promotionCodes = await stripe.promotionCodes.list({ code: code });
                for (const promoCode of promotionCodes.data) {
                    await stripe.promotionCodes.update(promoCode.id, { active: false });
                    console.log(`Deactivated promotion code: ${code}`);
                }
                
                // Delete coupon
                await stripe.coupons.del(code);
                console.log(`Deleted coupon: ${code}`);
            } catch (error) {
                console.log(`Could not delete ${code}:`, error.message);
            }
        }
        
        // Wait a moment then recreate
        setTimeout(async () => {
            await createPromotionCodes();
        }, 2000);
        
        res.json({ 
            message: 'Promotion codes recreation initiated',
            note: 'Codes will be recreated with 99% discount to show in payment history'
        });
    } catch (error) {
        console.error('Error recreating promotion codes:', error);
        res.status(500).json({ error: 'Failed to recreate promotion codes', details: error.message });
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
            // Force payment method collection even for 100% discounts
            payment_method_collection: 'always',
            automatic_tax: { enabled: false },
            // Force subscription creation even for free sessions
            subscription_data: {
                metadata: {
                    source: 'clipswift_extension'
                }
            }
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

// Debug endpoint to check session details
app.get('/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        console.log('🔍 Debug: Checking session:', sessionId);
        
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        
        res.json({
            session: {
                id: session.id,
                status: session.status,
                payment_status: session.payment_status,
                amount_total: session.amount_total,
                total_details: session.total_details,
                customer_email: session.customer_email,
                subscription: session.subscription,
                metadata: session.metadata
            }
        });
    } catch (error) {
        console.error('❌ Error retrieving session:', error);
        res.status(500).json({ error: 'Failed to retrieve session', details: error.message });
    }
});

// Test discount codes endpoint
app.get('/test-discount/:code', async (req, res) => {
    try {
        const { code } = req.params;
        console.log('🧪 Testing discount code:', code);
        
        // Create a test session with the specific discount code
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: 'price_1RzQRWLRp5AeS8F20zehtEpk', // Live price ID
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: 'https://clipswift-backend-production.up.railway.app/success',
            cancel_url: 'https://clipswift-backend-production.up.railway.app/cancel',
            allow_promotion_codes: true,
            payment_method_collection: 'always',
            automatic_tax: { enabled: false },
            subscription_data: {
                metadata: {
                    source: 'clipswift_extension'
                }
            }
        });
        
        res.json({
            message: `Test session created with discount code: ${code}`,
            sessionId: session.id,
            sessionUrl: session.url,
            amountTotal: session.amount_total,
            totalDetails: session.total_details
        });
    } catch (error) {
        console.error('❌ Error testing discount code:', error);
        res.status(500).json({ error: 'Failed to test discount code', details: error.message });
    }
});

// Track promotion code usage
app.get('/track-promotion/:code', async (req, res) => {
    try {
        const { code } = req.params;
        console.log('📊 Tracking promotion code usage:', code);
        
        // Get promotion codes with this code
        const promotionCodes = await stripe.promotionCodes.list({ code: code });
        
        if (promotionCodes.data.length === 0) {
            return res.status(404).json({ error: 'Promotion code not found' });
        }
        
        const promotionCode = promotionCodes.data[0];
        
        // Get detailed info about the promotion code
        const detailedPromoCode = await stripe.promotionCodes.retrieve(promotionCode.id);
        
        res.json({
            code: code,
            promotionCodeId: promotionCode.id,
            active: detailedPromoCode.active,
            coupon: detailedPromoCode.coupon,
            usageCount: detailedPromoCode.usage_count,
            maxRedemptions: detailedPromoCode.max_redemptions,
            timesRedeemed: detailedPromoCode.times_redeemed,
            restrictions: detailedPromoCode.restrictions,
            metadata: detailedPromoCode.metadata
        });
    } catch (error) {
        console.error('❌ Error tracking promotion code:', error);
        res.status(500).json({ error: 'Failed to track promotion code', details: error.message });
    }
});

// Get all promotion codes usage
app.get('/track-all-promotions', async (req, res) => {
    try {
        console.log('📊 Tracking all promotion codes usage');
        
        const codes = ['WELCOME10', 'LAUNCH20', 'SAVE50', 'FREETRIAL', 'FREE100'];
        const results = [];
        
        for (const code of codes) {
            try {
                const promotionCodes = await stripe.promotionCodes.list({ code: code });
                
                if (promotionCodes.data.length > 0) {
                    const promotionCode = promotionCodes.data[0];
                    const detailedPromoCode = await stripe.promotionCodes.retrieve(promotionCode.id);
                    
                    results.push({
                        code: code,
                        promotionCodeId: promotionCode.id,
                        active: detailedPromoCode.active,
                        usageCount: detailedPromoCode.usage_count,
                        timesRedeemed: detailedPromoCode.times_redeemed,
                        maxRedemptions: detailedPromoCode.max_redemptions
                    });
                } else {
                    results.push({
                        code: code,
                        error: 'Not found'
                    });
                }
            } catch (error) {
                results.push({
                    code: code,
                    error: error.message
                });
            }
        }
        
        res.json({
            message: 'All promotion codes usage tracked',
            results: results
        });
    } catch (error) {
        console.error('❌ Error tracking all promotion codes:', error);
        res.status(500).json({ error: 'Failed to track all promotion codes', details: error.message });
    }
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
        console.log('🔍 Verifying payment for session:', sessionId);

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        console.log('📊 Session details:', {
            id: session.id,
            status: session.status,
            payment_status: session.payment_status,
            amount_total: session.amount_total,
            total_details: session.total_details,
            customer_email: session.customer_email
        });
        
        // Check if session is completed (paid or free with discount)
        if (session.status === 'complete') {
            console.log('✅ Session completed successfully');
            res.json({ paymentStatus: 'completed' });
        } else if (session.payment_status === 'paid') {
            console.log('✅ Payment completed');
            res.json({ paymentStatus: 'completed' });
        } else if (session.status === 'expired') {
            console.log('❌ Session expired');
            res.json({ paymentStatus: 'expired' });
        } else {
            console.log('⏳ Session still pending');
            res.json({ paymentStatus: 'pending' });
        }
    } catch (error) {
        console.error('❌ Error verifying payment:', error);
        res.status(500).json({ error: 'Failed to verify payment', details: error.message });
    }
});

// Stripe webhook
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('❌ Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('📨 Webhook received:', event.type);

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log('✅ Checkout session completed:', {
                id: session.id,
                status: session.status,
                payment_status: session.payment_status,
                amount_total: session.amount_total,
                customer_email: session.customer_email,
                subscription: session.subscription
            });
            
            // Log if it was a free session (100% discount)
            if (session.amount_total === 0) {
                console.log('🎉 Free session completed with 100% discount!');
            }
            break;
            
        case 'checkout.session.expired':
            const expiredSession = event.data.object;
            console.log('⏰ Checkout session expired:', expiredSession.id);
            break;
            
        case 'invoice.payment_succeeded':
            const invoice = event.data.object;
            console.log('💰 Invoice payment succeeded:', {
                id: invoice.id,
                amount_paid: invoice.amount_paid,
                customer: invoice.customer
            });
            break;
            
        default:
            console.log(`📋 Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
});

app.listen(PORT, () => {
    console.log(`🚀 ClipSwift Backend server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 Main endpoint: http://localhost:${PORT}/`);
    
    // Check environment variables
    if (!process.env.STRIPE_SECRET_KEY) {
        console.warn('⚠️  STRIPE_SECRET_KEY not found - Stripe features will not work');
    } else {
        console.log('✅ Stripe configuration loaded');
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
