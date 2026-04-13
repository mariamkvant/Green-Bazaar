// === Local Storage Data Store ===
// Simulates backend — swap with real API calls later

const Store = {
  _get(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  },
  _set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },

  // --- Users ---
  getUsers() { return this._get("gb_users", []); },
  saveUser(user) {
    const users = this.getUsers();
    user.id = Date.now();
    user.verified = true;
    user.rating = 0;
    user.reviewCount = 0;
    user.joinDate = new Date().toISOString();
    users.push(user);
    this._set("gb_users", users);
    return user;
  },
  findUser(email) { return this.getUsers().find(u => u.email === email); },
  verifyUser(email) {
    const users = this.getUsers();
    const u = users.find(u => u.email === email);
    if (u) { u.verified = true; this._set("gb_users", users); }
    return u;
  },
  updateUserRating(sellerId) {
    const reviews = this.getReviews().filter(r => r.sellerId === sellerId);
    if (!reviews.length) return;
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    const users = this.getUsers();
    const u = users.find(u => u.id === sellerId);
    if (u) { u.rating = Math.round(avg * 10) / 10; u.reviewCount = reviews.length; this._set("gb_users", users); }
  },

  // --- Session ---
  login(user) { this._set("gb_session", { id: user.id, email: user.email, name: user.name, type: user.type, city: user.city }); },
  logout() { localStorage.removeItem("gb_session"); },
  getSession() { return this._get("gb_session", null); },
  isLoggedIn() { return !!this.getSession(); },

  // --- Orders ---
  getOrders() { return this._get("gb_orders", []); },
  createOrder(order) {
    const orders = this.getOrders();
    order.id = "ORD-" + Date.now();
    order.status = "paid"; // paid → shipped → delivered → completed | disputed
    order.escrowStatus = "held"; // held → released | refunded
    order.createdAt = new Date().toISOString();
    order.deliveryConfirmedAt = null;
    order.inspectionDeadline = null;
    order.timeline = [{ status: "paid", date: order.createdAt, note: "Payment received, funds held in escrow" }];
    orders.push(order);
    this._set("gb_orders", orders);
    return order;
  },
  updateOrder(orderId, updates) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return null;
    Object.assign(orders[idx], updates);
    if (updates.timelineEntry) {
      orders[idx].timeline.push({ ...updates.timelineEntry, date: new Date().toISOString() });
      delete orders[idx].timelineEntry;
    }
    this._set("gb_orders", orders);
    return orders[idx];
  },
  getOrdersForUser(userId) {
    return this.getOrders().filter(o => o.buyerId === userId || o.sellerId === userId);
  },

  // --- Messages ---
  getMessages() { return this._get("gb_messages", []); },
  sendMessage(msg) {
    const msgs = this.getMessages();
    msg.id = Date.now();
    msg.timestamp = new Date().toISOString();
    msg.read = false;
    msgs.push(msg);
    this._set("gb_messages", msgs);
    return msg;
  },
  getConversations(userId) {
    const msgs = this.getMessages().filter(m => m.senderId === userId || m.receiverId === userId);
    const convos = {};
    msgs.forEach(m => {
      const otherId = m.senderId === userId ? m.receiverId : m.senderId;
      const key = m.orderId ? `${otherId}-${m.orderId}` : `${otherId}`;
      if (!convos[key]) convos[key] = { otherId, otherName: m.senderId === userId ? m.receiverName : m.senderName, orderId: m.orderId, messages: [] };
      convos[key].messages.push(m);
    });
    return Object.values(convos).sort((a, b) => {
      const la = a.messages[a.messages.length - 1].timestamp;
      const lb = b.messages[b.messages.length - 1].timestamp;
      return lb.localeCompare(la);
    });
  },
  getUnreadCount(userId) {
    return this.getMessages().filter(m => m.receiverId === userId && !m.read).length;
  },
  markRead(userId, otherId) {
    const msgs = this.getMessages();
    msgs.forEach(m => { if (m.receiverId === userId && m.senderId === otherId) m.read = true; });
    this._set("gb_messages", msgs);
  },

  // --- Reviews ---
  getReviews() { return this._get("gb_reviews", []); },
  addReview(review) {
    const reviews = this.getReviews();
    review.id = Date.now();
    review.date = new Date().toISOString();
    reviews.push(review);
    this._set("gb_reviews", reviews);
    this.updateUserRating(review.sellerId);
    return review;
  },
  getReviewsForSeller(sellerId) {
    return this.getReviews().filter(r => r.sellerId === sellerId);
  },
  getReviewsForPlant(plantId) {
    return this.getReviews().filter(r => r.plantId === plantId);
  },

  // --- Disputes ---
  getDisputes() { return this._get("gb_disputes", []); },
  createDispute(dispute) {
    const disputes = this.getDisputes();
    dispute.id = "DSP-" + Date.now();
    dispute.status = "open"; // open → reviewing → resolved
    dispute.createdAt = new Date().toISOString();
    disputes.push(dispute);
    this._set("gb_disputes", disputes);
    // Update order status
    this.updateOrder(dispute.orderId, {
      status: "disputed",
      escrowStatus: "held",
      timelineEntry: { status: "disputed", note: `Dispute opened: ${dispute.reason}` }
    });
    return dispute;
  },
  getDisputesForUser(userId) {
    return this.getDisputes().filter(d => d.buyerId === userId || d.sellerId === userId);
  }
};
