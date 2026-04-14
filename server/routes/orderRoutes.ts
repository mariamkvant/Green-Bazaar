import { Router } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest } from '../auth';

const router = Router();

// Create order
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { listing_id, delivery_method, delivery_address, payment_method, quantity } = req.body;
    const listing = await db.get('SELECT * FROM listings WHERE id = ? AND active = true', listing_id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.seller_id === req.userId) return res.status(400).json({ error: 'Cannot buy your own listing' });
    // Check email verified
    const buyer = await db.get('SELECT verified, name FROM users WHERE id = ?', req.userId);
    if (!buyer?.verified) return res.status(403).json({ error: 'Please verify your email before purchasing' });
    const qty = Math.max(1, parseInt(quantity) || 1);
    const deliveryCost = delivery_method === 'courier' ? 10 : 0;
    const subtotal = listing.price * qty;
    const serviceFee = Math.round(subtotal * 0.07);
    const total = subtotal + deliveryCost + serviceFee;
    const result = await db.run(
      'INSERT INTO orders (buyer_id, seller_id, listing_id, total, price, delivery_cost, service_fee, delivery_method, delivery_address, payment_method) VALUES (?,?,?,?,?,?,?,?,?,?)',
      req.userId, listing.seller_id, listing_id, total, subtotal, deliveryCost, serviceFee, delivery_method || 'pickup', delivery_address || '', payment_method || 'card'
    );
    // Auto-message + notification
    await db.run('INSERT INTO messages (sender_id, receiver_id, order_id, listing_id, body) VALUES (?,?,?,?,?)',
      req.userId, listing.seller_id, result.id, listing_id,
      `🛒 New order #${result.id} for ${listing.name} (x${qty}). Delivery: ${delivery_method === 'courier' ? 'Courier' : 'Pickup'}. Please accept the order.`);
    await db.run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
      listing.seller_id, 'new_order', '🛒 New Order', `${buyer?.name || 'A buyer'} ordered ${listing.name} (x${qty}). Total: ₾${total}`, '/dashboard');
    const order = await db.get('SELECT * FROM orders WHERE id = ?', result.id);
    res.json(order);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get my orders
router.get('/my', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const orders = await db.all(`
      SELECT o.*, l.name as plant_name, l.image as plant_image, l.latin,
        buyer.name as buyer_name, seller.name as seller_name,
        seller.phone as seller_phone, buyer.phone as buyer_phone
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

// Step-by-step status transitions with notifications
router.put('/:id/status', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const { action } = req.body;
    const isBuyer = order.buyer_id === req.userId;
    const isSeller = order.seller_id === req.userId;
    const buyerName = (await db.get('SELECT name FROM users WHERE id=?', order.buyer_id))?.name || 'Buyer';
    const sellerName = (await db.get('SELECT name FROM users WHERE id=?', order.seller_id))?.name || 'Seller';
    const plantName = (await db.get('SELECT name FROM listings WHERE id=?', order.listing_id))?.name || 'Plant';

    if (action === 'accept' && isSeller && order.status === 'paid') {
      await db.run("UPDATE orders SET status = 'accepted' WHERE id = ?", order.id);
      await db.run('INSERT INTO messages (sender_id, receiver_id, order_id, body) VALUES (?,?,?,?)',
        order.seller_id, order.buyer_id, order.id, '✅ Order accepted! Preparing your plant...');
      await db.run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
        order.buyer_id, 'order_accepted', '✅ Order Accepted', `${sellerName} accepted your order for ${plantName}. They're preparing it now.`, '/dashboard');
    }
    else if (action === 'decline' && isSeller && order.status === 'paid') {
      await db.run("UPDATE orders SET status = 'cancelled', escrow_status = 'refunded' WHERE id = ?", order.id);
      await db.run('INSERT INTO messages (sender_id, receiver_id, order_id, body) VALUES (?,?,?,?)',
        order.seller_id, order.buyer_id, order.id, '❌ Order declined. Payment refunded.');
      await db.run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
        order.buyer_id, 'order_declined', '❌ Order Declined', `${sellerName} declined your order for ${plantName}. Your payment has been refunded.`, '/dashboard');
    }
    else if (action === 'ship' && isSeller && order.status === 'accepted') {
      await db.run("UPDATE orders SET status = 'shipped' WHERE id = ?", order.id);
      await db.run('INSERT INTO messages (sender_id, receiver_id, order_id, body) VALUES (?,?,?,?)',
        order.seller_id, order.buyer_id, order.id, '📦 Your order has been shipped / is ready for pickup!');
      await db.run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
        order.buyer_id, 'order_shipped', '📦 Order Shipped', `${plantName} has been shipped / is ready for pickup!`, '/dashboard');
    }
    else if (action === 'delivered' && isBuyer && order.status === 'shipped') {
      const deadline = new Date(); deadline.setDate(deadline.getDate() + 3);
      await db.run("UPDATE orders SET status = 'delivered', inspection_deadline = ? WHERE id = ?", deadline.toISOString(), order.id);
      await db.run('INSERT INTO messages (sender_id, receiver_id, order_id, body) VALUES (?,?,?,?)',
        order.buyer_id, order.seller_id, order.id, '📬 Delivery confirmed. 3-day inspection window started.');
      await db.run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
        order.seller_id, 'delivery_confirmed', '📬 Delivery Confirmed', `${buyerName} confirmed receiving ${plantName}. Inspection window: 3 days.`, '/dashboard');
    }
    else if (action === 'confirm' && isBuyer && order.status === 'delivered') {
      await db.run("UPDATE orders SET status = 'completed', escrow_status = 'released' WHERE id = ?", order.id);
      await db.run('INSERT INTO messages (sender_id, receiver_id, order_id, body) VALUES (?,?,?,?)',
        order.buyer_id, order.seller_id, order.id, `✅ Plant confirmed healthy! Payment of ₾${order.price} released.`);
      await db.run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
        order.seller_id, 'payment_released', '💰 Payment Released', `₾${order.price} released for ${plantName}. ${buyerName} confirmed the plant is healthy!`, '/dashboard');
      // Update seller completed orders count + check verified badge
      await db.run('UPDATE users SET completed_orders = completed_orders + 1 WHERE id = ?', order.seller_id);
      const seller = await db.get('SELECT completed_orders, rating FROM users WHERE id = ?', order.seller_id);
      if (seller && seller.completed_orders >= 5 && seller.rating >= 4.0) {
        await db.run('UPDATE users SET verified_seller = true WHERE id = ?', order.seller_id);
      }
    }
    else if (action === 'cancel' && isBuyer && ['paid', 'accepted'].includes(order.status)) {
      await db.run("UPDATE orders SET status = 'cancelled', escrow_status = 'refunded' WHERE id = ?", order.id);
      await db.run('INSERT INTO messages (sender_id, receiver_id, order_id, body) VALUES (?,?,?,?)',
        order.buyer_id, order.seller_id, order.id, '🚫 Order cancelled. Payment refunded.');
      await db.run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
        order.seller_id, 'order_cancelled', '🚫 Order Cancelled', `${buyerName} cancelled the order for ${plantName}.`, '/dashboard');
    }
    else if (action === 'nudge') {
      const targetId = isBuyer ? order.seller_id : order.buyer_id;
      const statusMsg: Record<string, string> = {
        paid: 'Please accept or decline the order.',
        accepted: 'Please ship the plant / mark as ready.',
        shipped: 'Please confirm you received the plant.',
        delivered: 'Please confirm the plant is healthy to release payment.',
      };
      const msg = statusMsg[order.status] || 'Please check this order.';
      await db.run('INSERT INTO messages (sender_id, receiver_id, order_id, body) VALUES (?,?,?,?)',
        req.userId, targetId, order.id, `👋 Friendly reminder: ${msg}`);
      await db.run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
        targetId, 'nudge', '👋 Reminder', `You have a pending action on order #${order.id}: ${msg}`, '/dashboard');
    }
    else {
      return res.status(400).json({ error: 'Invalid action for current status' });
    }

    const updated = await db.get('SELECT * FROM orders WHERE id = ?', order.id);
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
