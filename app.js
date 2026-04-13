// === Page Navigation ===
let currentPlantId = null;
let currentCheckoutPlant = null;
let currentConvo = null;
let pendingVerification = { email: "", type: "" };

function showPage(page, data) {
  document.querySelectorAll("[id^='page-']").forEach(p => p.style.display = "none");
  const el = document.getElementById("page-" + page);
  if (el) el.style.display = "block";
  window.scrollTo(0, 0);

  if (page === "plant" && data) renderPlantDetail(data);
  if (page === "dashboard") renderDashboard();
  if (page === "messages") renderMessages();
  if (page === "checkout" && data) renderCheckout(data);
}

// === Modal Helpers ===
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-overlay")) e.target.classList.remove("open");
  if (e.target.dataset.close) closeModal(e.target.dataset.close);
  if (e.target.classList.contains("privacy-link")) { e.preventDefault(); openModal("privacyModal"); }
});

// === Auth UI ===
function updateAuthUI() {
  const session = Store.getSession();
  document.getElementById("navLoggedOut").style.display = session ? "none" : "flex";
  document.getElementById("navLoggedIn").style.display = session ? "flex" : "none";
  if (session) {
    document.getElementById("navUserName").textContent = session.name;
    const unread = Store.getUnreadCount(session.id);
    const badge = document.getElementById("msgBadge");
    if (unread > 0) { badge.textContent = unread; badge.style.display = "inline"; }
    else badge.style.display = "none";
  }
}

// === Render Plant Cards ===
function renderPlants(list) {
  const grid = document.getElementById("plantGrid");
  const noResults = document.getElementById("noResults");
  if (list.length === 0) { grid.innerHTML = ""; noResults.style.display = "block"; return; }
  noResults.style.display = "none";

  grid.innerHTML = list.map(p => {
    const reviews = Store.getReviewsForPlant(p.id);
    const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
    const healthyCount = reviews.filter(r => r.condition === "healthy").length;
    const badgeClass = p.stock === "limited" ? "badge-limited" : p.stock === "preorder" ? "badge-preorder" : "badge-available";
    const badgeText = p.stock === "limited" ? "Limited Stock" : p.stock === "preorder" ? "Pre-order" : "Available";
    return `
      <article class="card" onclick="showPage('plant', ${p.id})" style="cursor:pointer;">
        <img class="card-img" src="${p.image}" alt="${p.name}" loading="lazy"
             onerror="this.style.background='#e8f5e2';this.alt='Image unavailable';">
        <div class="card-body">
          <span class="card-badge ${badgeClass}">${badgeText}</span>
          <h3 class="card-title">${p.name}</h3>
          <p class="card-latin">${p.latin}</p>
          <p class="card-desc">${p.description.substring(0, 100)}...</p>
          <div class="card-meta">
            <span>📏 ${p.height}</span>
            <span>🌱 ${p.age}</span>
            <span>📍 ${p.location}</span>
          </div>
          ${avgRating ? `<div class="card-rating">⭐ ${avgRating} (${reviews.length} reviews) ${healthyCount ? `· 🌿 ${healthyCount} arrived healthy` : ""}</div>` : ""}
          <div class="card-footer">
            <div>
              <span class="card-price">₾${p.price}</span>
              <span class="card-price-unit"> / ${p.unit}</span>
            </div>
            <span class="card-seller">by <strong>${p.seller}</strong></span>
          </div>
        </div>
      </article>`;
  }).join("");
}

let activeFilter = "all";
function filterPlants() {
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  return plants.filter(p => {
    const matchFilter = activeFilter === "all" || p.tags.includes(activeFilter);
    const matchSearch = !query || p.name.toLowerCase().includes(query) || p.latin.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) || p.seller.toLowerCase().includes(query) || p.location.toLowerCase().includes(query);
    return matchFilter && matchSearch;
  });
}

// === Plant Detail Page ===
function renderPlantDetail(plantId) {
  currentPlantId = plantId;
  const p = plants.find(x => x.id === plantId);
  if (!p) return;
  const reviews = Store.getReviewsForPlant(p.id);
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
  const healthyPct = reviews.length ? Math.round(reviews.filter(r => r.condition === "healthy").length / reviews.length * 100) : 0;
  const session = Store.getSession();

  document.getElementById("plantDetail").innerHTML = `
    <div class="detail-grid">
      <div class="detail-img-wrap">
        <img src="${p.image}" alt="${p.name}" class="detail-img" onerror="this.style.background='#e8f5e2';">
      </div>
      <div class="detail-info">
        <span class="card-badge ${p.stock === 'limited' ? 'badge-limited' : p.stock === 'preorder' ? 'badge-preorder' : 'badge-available'}">${p.stock === 'limited' ? 'Limited Stock' : p.stock === 'preorder' ? 'Pre-order' : 'Available'}</span>
        <h1>${p.name}</h1>
        <p class="card-latin">${p.latin}</p>
        ${avgRating ? `<div class="detail-rating">⭐ ${avgRating}/5 from ${reviews.length} reviews ${healthyPct ? `· 🌿 ${healthyPct}% arrived healthy` : ""}</div>` : '<div class="detail-rating">No reviews yet</div>'}
        <p class="detail-desc">${p.description}</p>
        <div class="detail-specs">
          <div class="spec"><span class="spec-label">Height</span><span>${p.height}</span></div>
          <div class="spec"><span class="spec-label">Age</span><span>${p.age}</span></div>
          <div class="spec"><span class="spec-label">Location</span><span>📍 ${p.location}</span></div>
          <div class="spec"><span class="spec-label">Seller</span><span>${p.seller}</span></div>
        </div>
        <div class="detail-price">
          <span class="card-price" style="font-size:1.6rem;">₾${p.price}</span>
          <span class="card-price-unit"> / ${p.unit}</span>
        </div>
        <div class="detail-actions">
          <button class="btn btn-primary btn-lg" onclick="handleBuyNow(${p.id})">🛒 Buy Now — Escrow Protected</button>
          <button class="btn btn-outline" onclick="handleMessageSeller(${p.id})">💬 Message Seller</button>
        </div>
        <div class="escrow-badge">
          <span>🔒</span> Payment held in escrow until you confirm delivery. 3-day inspection window.
        </div>
      </div>
    </div>`;

  // Reviews section
  const reviewsHtml = reviews.length ? reviews.map(r => `
    <div class="review-card">
      <div class="review-header">
        <span class="review-stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
        <span class="review-condition ${r.condition === 'healthy' ? 'condition-healthy' : r.condition === 'good' ? 'condition-good' : 'condition-bad'}">
          ${r.condition === 'healthy' ? '🌿 Arrived Healthy' : r.condition === 'good' ? '👍 Good Condition' : '⚠️ Had Issues'}
        </span>
      </div>
      <p class="review-text">${r.text || "No comment"}</p>
      <p class="review-meta">by ${r.buyerName} · ${new Date(r.date).toLocaleDateString()}</p>
    </div>`).join("") : '<p class="no-reviews">No reviews yet. Be the first buyer!</p>';

  document.getElementById("reviewsSection").innerHTML = `<h2>Reviews</h2>${reviewsHtml}`;
}

// === Buy Now ===
function handleBuyNow(plantId) {
  const session = Store.getSession();
  if (!session) { showToast("Please log in or register to buy"); openModal("loginModal"); return; }
  if (session.type === "seller") { showToast("Switch to a buyer account to purchase"); return; }
  showPage("checkout", plantId);
}

// === Message Seller ===
function handleMessageSeller(plantId) {
  const session = Store.getSession();
  if (!session) { showToast("Please log in to message sellers"); openModal("loginModal"); return; }
  const p = plants.find(x => x.id === plantId);
  if (!p) return;
  // Create initial message
  Store.sendMessage({
    senderId: session.id, senderName: session.name,
    receiverId: p.sellerId || 1000, receiverName: p.seller,
    plantId: p.id, orderId: null,
    text: `Hi, I'm interested in your ${p.name}. Is it still available?`
  });
  showToast("Message sent! Check your Messages tab.");
  showPage("messages");
}

// === Checkout ===
function renderCheckout(plantId) {
  const p = plants.find(x => x.id === plantId);
  if (!p) return;
  currentCheckoutPlant = p;
  const serviceFee = Math.round(p.price * 0.07);

  document.getElementById("checkoutSummary").innerHTML = `
    <div class="checkout-item">
      <img src="${p.image}" alt="${p.name}" class="checkout-img" onerror="this.style.background='#e8f5e2';">
      <div>
        <h3>${p.name}</h3>
        <p class="card-latin">${p.latin}</p>
        <p>📍 ${p.location} · by ${p.seller}</p>
      </div>
    </div>`;

  updateOrderTotal();
  document.getElementById("checkoutBack").onclick = (e) => { e.preventDefault(); showPage("plant", plantId); };
}

function updateOrderTotal() {
  if (!currentCheckoutPlant) return;
  const p = currentCheckoutPlant;
  const delivery = document.querySelector('input[name="delivery"]:checked').value;
  const deliveryCost = delivery === "courier" ? 10 : 0;
  const serviceFee = Math.round(p.price * 0.07);
  const total = p.price + deliveryCost + serviceFee;

  document.getElementById("orderTotal").innerHTML = `
    <div class="total-row"><span>Plant price</span><span>₾${p.price}</span></div>
    <div class="total-row"><span>Delivery</span><span>${deliveryCost ? "₾" + deliveryCost : "Free"}</span></div>
    <div class="total-row"><span>Service fee (7%)</span><span>₾${serviceFee}</span></div>
    <div class="total-row total-final"><span>Total (held in escrow)</span><span>₾${total}</span></div>`;
}

// Delivery method toggle
document.addEventListener("change", (e) => {
  if (e.target.name === "delivery") {
    document.getElementById("deliveryAddress").style.display = e.target.value === "courier" ? "block" : "none";
    updateOrderTotal();
  }
  if (e.target.name === "payment") {
    document.getElementById("cardFields").style.display = e.target.value === "card" ? "block" : "none";
    document.getElementById("transferFields").style.display = e.target.value === "transfer" ? "block" : "none";
  }
});

document.getElementById("checkoutForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const session = Store.getSession();
  if (!session || !currentCheckoutPlant) return;
  const p = currentCheckoutPlant;
  const delivery = document.querySelector('input[name="delivery"]:checked').value;
  const deliveryCost = delivery === "courier" ? 10 : 0;
  const serviceFee = Math.round(p.price * 0.07);

  const order = Store.createOrder({
    plantId: p.id, plantName: p.name, plantImage: p.image,
    buyerId: session.id, buyerName: session.name,
    sellerId: p.sellerId || 1000, sellerName: p.seller,
    price: p.price, deliveryCost, serviceFee,
    total: p.price + deliveryCost + serviceFee,
    deliveryMethod: delivery,
    deliveryAddress: delivery === "courier" ? document.getElementById("addressInput").value : "Local pickup",
    paymentMethod: document.querySelector('input[name="payment"]:checked').value
  });

  // Auto-message seller about the order
  Store.sendMessage({
    senderId: session.id, senderName: session.name,
    receiverId: p.sellerId || 1000, receiverName: p.seller,
    orderId: order.id, plantId: p.id,
    text: `🛒 New order placed! Order ${order.id} for ${p.name}. Delivery: ${delivery === "courier" ? "Courier" : "Local Pickup"}. Payment is held in escrow.`
  });

  showToast(`Order ${order.id} placed! Payment held in escrow.`);
  showPage("dashboard");
});

// === Dashboard ===
function renderDashboard() {
  const session = Store.getSession();
  if (!session) { showPage("home"); return; }
  const orders = Store.getOrdersForUser(session.id);
  const disputes = Store.getDisputesForUser(session.id);

  // Tab switching
  document.querySelectorAll(".dash-tab").forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll(".dash-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      renderDashTab(tab.dataset.tab, orders, disputes, session);
    };
  });
  renderDashTab("orders", orders, disputes, session);
}

function renderDashTab(tab, orders, disputes, session) {
  const content = document.getElementById("dashContent");

  if (tab === "orders") {
    const buyOrders = orders.filter(o => o.buyerId === session.id);
    if (!buyOrders.length) { content.innerHTML = '<p class="dash-empty">No orders yet. <a href="#" onclick="showPage(\'home\')">Browse plants</a></p>'; return; }
    content.innerHTML = buyOrders.map(o => renderOrderCard(o, "buyer")).join("");
  }
  else if (tab === "sales") {
    const sales = orders.filter(o => o.sellerId === session.id);
    if (!sales.length) { content.innerHTML = '<p class="dash-empty">No sales yet.</p>'; return; }
    content.innerHTML = sales.map(o => renderOrderCard(o, "seller")).join("");
  }
  else if (tab === "disputes") {
    if (!disputes.length) { content.innerHTML = '<p class="dash-empty">No disputes. That\'s great!</p>'; return; }
    content.innerHTML = disputes.map(d => `
      <div class="order-card dispute-card">
        <div class="order-header">
          <span class="order-id">${d.id}</span>
          <span class="order-status status-${d.status}">${d.status.toUpperCase()}</span>
        </div>
        <p>Order: ${d.orderId} · Reason: ${d.reason}</p>
        <p>${d.description}</p>
        <p class="order-date">Opened: ${new Date(d.createdAt).toLocaleDateString()}</p>
      </div>`).join("");
  }
}

function renderOrderCard(o, role) {
  const statusColors = { paid: "#1565c0", shipped: "#e65100", delivered: "#2d5a27", completed: "#2d5a27", disputed: "#d32f2f" };
  const escrowColors = { held: "#e65100", released: "#2d5a27", refunded: "#d32f2f" };

  let actions = "";
  if (role === "seller" && o.status === "paid") {
    actions = `<button class="btn btn-primary btn-sm" onclick="markShipped('${o.id}')">📦 Mark as Shipped</button>`;
  }
  if (role === "buyer" && o.status === "shipped") {
    actions = `<button class="btn btn-primary btn-sm" onclick="confirmDelivery('${o.id}')">✅ Confirm Delivery</button>`;
  }
  if (role === "buyer" && o.status === "delivered") {
    const deadline = o.inspectionDeadline ? new Date(o.inspectionDeadline) : null;
    const daysLeft = deadline ? Math.max(0, Math.ceil((deadline - new Date()) / 86400000)) : 3;
    actions = `
      <div class="inspection-notice">🔍 Inspection window: ${daysLeft} days remaining</div>
      <button class="btn btn-primary btn-sm" onclick="confirmHealthy('${o.id}')">🌿 Plant is Healthy — Release Payment</button>
      <button class="btn btn-outline btn-sm" onclick="openDisputeModal('${o.id}')">⚠️ Report Issue</button>`;
  }
  if (role === "buyer" && o.status === "completed" && !Store.getReviews().find(r => r.orderId === o.id)) {
    actions = `<button class="btn btn-outline btn-sm" onclick="openReviewModal('${o.id}')">⭐ Leave Review</button>`;
  }

  return `
    <div class="order-card">
      <div class="order-header">
        <span class="order-id">${o.id}</span>
        <div>
          <span class="order-status" style="background:${statusColors[o.status] || '#888'}">${o.status.toUpperCase()}</span>
          <span class="escrow-status" style="background:${escrowColors[o.escrowStatus] || '#888'}">Escrow: ${o.escrowStatus}</span>
        </div>
      </div>
      <div class="order-body">
        <img src="${o.plantImage}" alt="${o.plantName}" class="order-img" onerror="this.style.background='#e8f5e2';">
        <div>
          <h3>${o.plantName}</h3>
          <p>${role === "buyer" ? "Seller: " + o.sellerName : "Buyer: " + o.buyerName}</p>
          <p>Delivery: ${o.deliveryMethod === "courier" ? "🚚 Courier" : "🏪 Pickup"}</p>
          <p class="order-total">Total: ₾${o.total}</p>
        </div>
      </div>
      <div class="order-timeline">${o.timeline.map(t => `<div class="timeline-item"><span class="timeline-dot"></span><span>${t.note}</span><small>${new Date(t.date).toLocaleString()}</small></div>`).join("")}</div>
      <div class="order-actions">${actions}</div>
    </div>`;
}

// === Order Actions ===
function markShipped(orderId) {
  Store.updateOrder(orderId, { status: "shipped", timelineEntry: { status: "shipped", note: "📦 Seller marked as shipped / ready for pickup" } });
  const order = Store.getOrders().find(o => o.id === orderId);
  if (order) {
    Store.sendMessage({
      senderId: order.sellerId, senderName: order.sellerName,
      receiverId: order.buyerId, receiverName: order.buyerName,
      orderId, text: `📦 Your order ${orderId} has been shipped / is ready for pickup!`
    });
  }
  showToast("Marked as shipped! Buyer has been notified.");
  renderDashboard();
}

function confirmDelivery(orderId) {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 3);
  Store.updateOrder(orderId, {
    status: "delivered",
    deliveryConfirmedAt: new Date().toISOString(),
    inspectionDeadline: deadline.toISOString(),
    timelineEntry: { status: "delivered", note: "📬 Delivery confirmed. 3-day inspection window started." }
  });
  showToast("Delivery confirmed! You have 3 days to inspect the plant.");
  renderDashboard();
}

function confirmHealthy(orderId) {
  Store.updateOrder(orderId, {
    status: "completed",
    escrowStatus: "released",
    timelineEntry: { status: "completed", note: "✅ Buyer confirmed plant is healthy. Payment released to seller." }
  });
  const order = Store.getOrders().find(o => o.id === orderId);
  if (order) {
    Store.sendMessage({
      senderId: order.buyerId, senderName: order.buyerName,
      receiverId: order.sellerId, receiverName: order.sellerName,
      orderId, text: `✅ Plant confirmed healthy! Payment of ₾${order.price} has been released to you. Thank you!`
    });
  }
  showToast("Payment released to seller! Please leave a review.");
  openReviewModal(orderId);
}

// === Review Modal ===
let currentReviewOrderId = null;
function openReviewModal(orderId) {
  currentReviewOrderId = orderId;
  const order = Store.getOrders().find(o => o.id === orderId);
  if (!order) return;
  document.getElementById("reviewOrderInfo").innerHTML = `<p>Order: <strong>${order.id}</strong> — ${order.plantName}</p>`;
  document.getElementById("ratingValue").value = "0";
  document.querySelectorAll("#starRating .star").forEach(s => s.textContent = "☆");
  openModal("reviewModal");
}

// Star rating interaction
document.getElementById("starRating").addEventListener("click", (e) => {
  if (!e.target.classList.contains("star")) return;
  const val = parseInt(e.target.dataset.val);
  document.getElementById("ratingValue").value = val;
  document.querySelectorAll("#starRating .star").forEach(s => {
    s.textContent = parseInt(s.dataset.val) <= val ? "★" : "☆";
  });
});

document.getElementById("reviewForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const rating = parseInt(document.getElementById("ratingValue").value);
  if (!rating) { showToast("Please select a star rating"); return; }
  const condition = document.querySelector('input[name="condition"]:checked');
  if (!condition) { showToast("Please select plant condition"); return; }
  const session = Store.getSession();
  const order = Store.getOrders().find(o => o.id === currentReviewOrderId);
  if (!session || !order) return;

  Store.addReview({
    orderId: order.id, plantId: order.plantId,
    buyerId: session.id, buyerName: session.name,
    sellerId: order.sellerId,
    rating, condition: condition.value,
    text: document.getElementById("reviewText").value
  });
  closeModal("reviewModal");
  showToast("Review submitted! Thank you.");
  renderDashboard();
});

// === Dispute Modal ===
let currentDisputeOrderId = null;
function openDisputeModal(orderId) {
  currentDisputeOrderId = orderId;
  const order = Store.getOrders().find(o => o.id === orderId);
  if (!order) return;
  document.getElementById("disputeOrderInfo").innerHTML = `<p>Order: <strong>${order.id}</strong> — ${order.plantName}</p>`;
  openModal("disputeModal");
}

document.getElementById("disputeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const session = Store.getSession();
  const order = Store.getOrders().find(o => o.id === currentDisputeOrderId);
  if (!session || !order) return;

  Store.createDispute({
    orderId: order.id, plantId: order.plantId,
    buyerId: session.id, buyerName: session.name,
    sellerId: order.sellerId, sellerName: order.sellerName,
    reason: document.getElementById("disputeReason").value,
    description: document.getElementById("disputeDesc").value,
    requestedResolution: document.querySelector('input[name="resolution"]:checked').value
  });

  Store.sendMessage({
    senderId: session.id, senderName: session.name,
    receiverId: order.sellerId, receiverName: order.sellerName,
    orderId: order.id,
    text: `⚠️ A dispute has been opened for order ${order.id}. Reason: ${document.getElementById("disputeReason").value}. Our mediation team will review within 48 hours.`
  });

  closeModal("disputeModal");
  showToast("Dispute submitted. Our team will review within 48 hours.");
  renderDashboard();
});

// === Messages ===
function renderMessages() {
  const session = Store.getSession();
  if (!session) { showPage("home"); return; }
  const convos = Store.getConversations(session.id);
  const list = document.getElementById("msgList");
  const chat = document.getElementById("msgChat");

  if (!convos.length) {
    list.innerHTML = '<p class="msg-empty">No messages yet</p>';
    chat.innerHTML = '<p class="msg-empty">Select a conversation</p>';
    return;
  }

  list.innerHTML = convos.map((c, i) => {
    const lastMsg = c.messages[c.messages.length - 1];
    const unread = c.messages.filter(m => m.receiverId === session.id && !m.read).length;
    return `<div class="msg-item ${i === 0 && !currentConvo ? 'active' : ''}" data-idx="${i}">
      <div class="msg-item-header">
        <strong>${c.otherName}</strong>
        ${unread ? `<span class="msg-unread">${unread}</span>` : ""}
      </div>
      <p class="msg-preview">${lastMsg.text.substring(0, 50)}...</p>
      ${c.orderId ? `<span class="msg-order">${c.orderId}</span>` : ""}
    </div>`;
  }).join("");

  // Click handler for conversations
  list.querySelectorAll(".msg-item").forEach(item => {
    item.addEventListener("click", () => {
      list.querySelectorAll(".msg-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      const convo = convos[parseInt(item.dataset.idx)];
      currentConvo = convo;
      Store.markRead(session.id, convo.otherId);
      updateAuthUI();
      renderChat(convo, session);
    });
  });

  // Auto-select first
  if (convos.length && !currentConvo) {
    currentConvo = convos[0];
    Store.markRead(session.id, convos[0].otherId);
    renderChat(convos[0], session);
  }
}

function renderChat(convo, session) {
  const chat = document.getElementById("msgChat");
  chat.innerHTML = `
    <div class="chat-header">
      <strong>${convo.otherName}</strong>
      ${convo.orderId ? ` · Order: ${convo.orderId}` : ""}
    </div>
    <div class="chat-messages" id="chatMessages">
      ${convo.messages.map(m => `
        <div class="chat-msg ${m.senderId === session.id ? 'msg-mine' : 'msg-theirs'}">
          <p>${m.text}</p>
          <small>${new Date(m.timestamp).toLocaleString()}</small>
        </div>`).join("")}
    </div>
    <form class="chat-input" id="chatForm">
      <input type="text" id="chatText" placeholder="Type a message..." required>
      <button type="submit" class="btn btn-primary">Send</button>
    </form>`;

  // Scroll to bottom
  const msgs = document.getElementById("chatMessages");
  msgs.scrollTop = msgs.scrollHeight;

  document.getElementById("chatForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = document.getElementById("chatText").value.trim();
    if (!text) return;
    Store.sendMessage({
      senderId: session.id, senderName: session.name,
      receiverId: convo.otherId, receiverName: convo.otherName,
      orderId: convo.orderId, plantId: null,
      text
    });
    document.getElementById("chatText").value = "";
    // Re-render
    const updatedConvos = Store.getConversations(session.id);
    const updated = updatedConvos.find(c => c.otherId === convo.otherId && c.orderId === convo.orderId);
    if (updated) renderChat(updated, session);
  });
}

// === Registration & Auth ===
document.getElementById("sellBtn").addEventListener("click", (e) => { e.preventDefault(); openModal("sellModal"); });
document.getElementById("registerBuyerBtn").addEventListener("click", (e) => { e.preventDefault(); openModal("buyerModal"); });
document.getElementById("loginBtn").addEventListener("click", (e) => { e.preventDefault(); openModal("loginModal"); });
document.getElementById("switchToRegister").addEventListener("click", (e) => { e.preventDefault(); closeModal("loginModal"); openModal("buyerModal"); });
document.getElementById("logoutBtn").addEventListener("click", (e) => {
  e.preventDefault(); Store.logout(); currentConvo = null; updateAuthUI(); showPage("home"); showToast("Logged out");
});

// Login
document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const user = Store.findUser(email);
  if (!user) { showToast("Account not found. Please register first."); return; }
  if (user.password !== password) { showToast("Incorrect password"); return; }
  if (!user.verified) { showToast("Please verify your email first"); return; }
  Store.login(user);
  closeModal("loginModal");
  updateAuthUI();
  showToast(`Welcome back, ${user.name}!`);
  e.target.reset();
});

// Seller registration
document.getElementById("sellerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("sellerEmail").value;
  if (Store.findUser(email)) { showToast("An account with this email already exists"); return; }
  Store.saveUser({
    name: document.getElementById("sellerName").value,
    email, phone: document.getElementById("sellerPhone").value,
    city: document.getElementById("sellerCity").value,
    plants: document.getElementById("sellerPlants").value,
    password: document.getElementById("sellerPassword").value,
    type: "seller"
  });
  pendingVerification = { email, type: "seller" };
  closeModal("sellModal");
  const user = Store.findUser(email);
  Store.login(user);
  updateAuthUI();
  showToast(`Welcome to მწვანე ბაზარი, ${user.name}! 🌿`);
  e.target.reset();
});

// Buyer registration
document.getElementById("buyerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("regBuyerEmail").value;
  if (Store.findUser(email)) { showToast("An account with this email already exists"); return; }
  Store.saveUser({
    name: document.getElementById("regBuyerName").value,
    email, phone: document.getElementById("regBuyerPhone").value,
    city: document.getElementById("regBuyerCity").value,
    password: document.getElementById("regBuyerPassword").value,
    type: "buyer"
  });
  pendingVerification = { email, type: "buyer" };
  closeModal("buyerModal");
  const user = Store.findUser(email);
  Store.login(user);
  updateAuthUI();
  showToast(`Welcome to მწვანე ბაზარი, ${user.name}! 🌿`);
  e.target.reset();
});

// Email verification
document.getElementById("verifyForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = document.getElementById("verifyCode").value;
  if (code.length === 6) {
    const user = Store.verifyUser(pendingVerification.email);
    if (user) {
      Store.login(user);
      closeModal("verifyModal");
      updateAuthUI();
      showToast(`Welcome to მწვანე ბაზარი, ${user.name}! 🌿`);
      document.getElementById("sellerForm").reset();
      document.getElementById("buyerForm").reset();
      document.getElementById("verifyCode").value = "";
    }
  }
});

document.getElementById("resendCode").addEventListener("click", (e) => {
  e.preventDefault();
  showToast(`Verification code resent to ${pendingVerification.email}`);
});

// === Filter & Search Events ===
document.querySelectorAll(".tag").forEach(tag => {
  tag.addEventListener("click", () => {
    document.querySelectorAll(".tag").forEach(t => t.classList.remove("active"));
    tag.classList.add("active");
    activeFilter = tag.dataset.filter;
    renderPlants(filterPlants());
  });
});
document.getElementById("searchInput").addEventListener("input", () => renderPlants(filterPlants()));
document.getElementById("searchBtn").addEventListener("click", () => renderPlants(filterPlants()));

// === Mobile Menu ===
document.getElementById("mobileMenuBtn").addEventListener("click", () => {
  document.getElementById("mainNav").classList.toggle("open");
});

// === Toast ===
function showToast(msg) {
  let toast = document.querySelector(".toast");
  if (!toast) { toast = document.createElement("div"); toast.className = "toast"; document.body.appendChild(toast); }
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

// === Init ===
updateAuthUI();
renderPlants(plants);
showPage("home");
