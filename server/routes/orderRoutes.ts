import { Router } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest } from '../auth';

const router = Router();

// Create order
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { listing_id, delivery_method, delivery_address, payment_method } = req.body;
    const listing = await db.get('SELECT * FROM listings WHERE id = ? AND active = true', listing_id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.seller_id === req.userId) return res.status(400).json({ error: 'Cannot buy your own listing' });
    const deliveryCost = delivery_method === 'courier' ? 10 : 0;
    const serviceFee = Math.round(listing.price * 0.07);
    const total = listing.price + deliveryCost + serviceFee;
    const result = await db.run(
      'INSERT INTO orders (buyer_id, seller_id, listing_id, total, price, delivery_cost, service_fee, delivery_method, delivery_address, payment_method) VALUES (?,?,?,?,?,?,?,?,?,?)',
      req.userId, listing.seller_id, listing_id, total, listing.price, deliveryCost, serviceFee, delivery_method || 'pickup', delivery_address || '', payment_method || 'card'
    );
    // Auto-message seller
    const buyer = await db.get('SELECT name FROM users WHERE id = ?', req.userId);
    await db.run('INSERT INTO messages (sender_id, receiver_id, order_id, listing_id, body) VALUES (?,?,?,?,?)',
      req.userId, listing.seller_id, result.id, listing_id, `🛒 New order for ${listing.name}. Delivery: ${delivery_method === 'courier' ? 'Courier' : 'Pickup'}. Payment held in escrow.`);
    const order = await db.get('SELECT * FROM orders WHERE id = ?', result.id);
    res.json(order);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get my orders
router.get('/my', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const orders = await db.all(`
      SELECT o.*, l.name as plant_name, l.image as plant_image, l.latin,
        buyer.name as buyer_name, seller.name as seller_name
      FROM orders o
      JOIN listings l ON o.listing_id = l.id
      JOIN users buyer ON o.buyer_id = buyer.id
      JOIN users seller ON o.seller_id = seller.id
      WHERE o.buyer_id = ? OR o.seller_id = ?
      ORDER BY o.created_at DESC
    `, req.userId, req.userId);
    res.json(orders);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Update order status (ship, confirm delivery, confirm healthy, etc.)
router.put('/:id/status', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const { action } = req.body;

    if (action === 'ship' && order.seller_id === req.userId && order.status === 'paid') {
      await db.run("UPDATE orders SET status = 'shipped' WHERE id = ?", order.id);
      await db.run('INSERT INTO messages (sender_id, receiver_id, order_id, body) VALUES (?,?,?,?)',
        order.seller_id, order.buyer_id, order.id, '📦 Your order has been shipped / is ready for pickup!');
    }
    else if (action === 'delivered' && order.buyer_id === req.userId && order.status === 'shipped') {
      const deadline = new Date(); deadline.setDate(deadline.getDate() + 3);
      await db.run("UPDATE orders SET status = 'delivered', inspection_deadline = ? WHERE id = ?", deadline.toISOString(), order.id);
    }
    else if (action === 'confirm' && order.buyer_id === req.userId && order.status === 'delivered') {
      await db.run("UPDATE orders SET status = 'completed', escrow_status = 'released' WHERE id = ?", order.id);
      await db.run('INSERT INTO messages (sender_id, receiver_id, order_id, body) VALUES (?,?,?,?)',
        order.buyer_id, order.seller_id, order.id, `✅ Plant confirmed healthy! Payment of ₾${order.price} released.`);
    }
    else { return res.status(400).json({ error: 'Invalid action for current status' }); }

    const updated = await db.get('SELECT * FROM orders WHERE id = ?', order.id);
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
