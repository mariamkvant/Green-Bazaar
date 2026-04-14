// === API Client — replaces localStorage Store ===
const API = '';

function getToken() { return localStorage.getItem('gb_token'); }
function headers() {
  const h = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) h['Authorization'] = 'Bearer ' + t;
  return h;
}

async function api(method, path, body) {
  const opts = { method, headers: headers() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const Store = {
  // --- Auth ---
  async register(data) {
    const res = await api('POST', '/api/users/register', data);
    localStorage.setItem('gb_token', res.token);
    localStorage.setItem('gb_session', JSON.stringify(res.user));
    return res.user;
  },
  async login(email, password) {
    const res = await api('POST', '/api/users/login', { email, password });
    localStorage.setItem('gb_token', res.token);
    localStorage.setItem('gb_session', JSON.stringify(res.user));
    return res.user;
  },
  logout() {
    localStorage.removeItem('gb_token');
    localStorage.removeItem('gb_session');
  },
  getSession() {
    try { return JSON.parse(localStorage.getItem('gb_session')); } catch { return null; }
  },
  isLoggedIn() { return !!getToken(); },

  // --- Profile ---
  async getProfile() { return api('GET', '/api/users/me'); },
  async updateProfile(data) {
    const user = await api('PUT', '/api/users/me', data);
    localStorage.setItem('gb_session', JSON.stringify(user));
    return user;
  },

  // --- Listings ---
  async getListings() { return api('GET', '/api/listings'); },
  async getListing(id) { return api('GET', '/api/listings/' + id); },
  async createListing(data) { return api('POST', '/api/listings', data); },
  async updateListing(id, data) { return api('PUT', '/api/listings/' + id, data); },
  async deleteListing(id) { return api('DELETE', '/api/listings/' + id); },
  async getMyListings() { return api('GET', '/api/listings/my/all'); },

  // --- Orders ---
  async createOrder(data) { return api('POST', '/api/orders', data); },
  async getMyOrders() { return api('GET', '/api/orders/my'); },
  async updateOrderStatus(id, action) { return api('PUT', '/api/orders/' + id + '/status', { action }); },

  // --- Messages ---
  async getConversations() { return api('GET', '/api/messages/conversations'); },
  async sendMessage(data) { return api('POST', '/api/messages', data); },
  async markRead(otherId) { return api('PUT', '/api/messages/read/' + otherId); },
  async getUnreadCount() {
    try { const r = await api('GET', '/api/messages/unread'); return r.count || 0; }
    catch { return 0; }
  },

  // --- Reviews ---
  async addReview(data) { return api('POST', '/api/reviews', data); },
  async getReviewsForListing(id) { return api('GET', '/api/reviews/listing/' + id); },

  // --- Disputes ---
  async createDispute(data) { return api('POST', '/api/disputes', data); },
  async getMyDisputes() { return api('GET', '/api/disputes/my'); },

  // --- Favorites ---
  async getFavorites() { return api('GET', '/api/favorites'); },
  async getFavoriteIds() { return api('GET', '/api/favorites/ids'); },
  async addFavorite(listingId) { return api('POST', '/api/favorites/' + listingId); },
  async removeFavorite(listingId) { return api('DELETE', '/api/favorites/' + listingId); },

  // --- Notifications ---
  async getNotifications() { return api('GET', '/api/notifications'); },
  async getNotifCount() { try { const r = await api('GET', '/api/notifications/unread'); return r.count || 0; } catch { return 0; } },
  async markNotifsRead() { return api('PUT', '/api/notifications/read'); },

  // --- Seller Profile ---
  async getSellerProfile(id) { return api('GET', '/api/listings/seller/' + id + '/profile'); },
};
