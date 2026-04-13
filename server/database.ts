import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL || process.env[' DATABASE_URL'] || process.env.DATABASE_PRIVATE_URL || Object.entries(process.env).find(([k]) => k.trim() === 'DATABASE_URL')?.[1];
const pool = new Pool(dbUrl ? { connectionString: dbUrl, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined } : { host: 'localhost', port: 5432, user: 'postgres', password: 'postgres', database: 'greenbazaar' });

export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        phone TEXT,
        city TEXT,
        type TEXT NOT NULL DEFAULT 'buyer',
        bio TEXT DEFAULT '',
        avatar TEXT,
        rating REAL DEFAULT 0,
        review_count INTEGER DEFAULT 0,
        verified BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS listings (
        id SERIAL PRIMARY KEY,
        seller_id INTEGER NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        latin TEXT DEFAULT '',
        category TEXT NOT NULL,
        price INTEGER NOT NULL,
        unit TEXT DEFAULT 'per plant',
        height TEXT,
        age TEXT,
        stock TEXT DEFAULT 'available',
        description TEXT NOT NULL,
        image TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        buyer_id INTEGER NOT NULL REFERENCES users(id),
        seller_id INTEGER NOT NULL REFERENCES users(id),
        listing_id INTEGER NOT NULL REFERENCES listings(id),
        status TEXT DEFAULT 'paid',
        escrow_status TEXT DEFAULT 'held',
        total INTEGER NOT NULL,
        price INTEGER NOT NULL,
        delivery_cost INTEGER DEFAULT 0,
        service_fee INTEGER DEFAULT 0,
        delivery_method TEXT DEFAULT 'pickup',
        delivery_address TEXT,
        payment_method TEXT DEFAULT 'card',
        inspection_deadline TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id),
        receiver_id INTEGER NOT NULL REFERENCES users(id),
        order_id INTEGER REFERENCES orders(id),
        listing_id INTEGER REFERENCES listings(id),
        body TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id),
        listing_id INTEGER NOT NULL REFERENCES listings(id),
        buyer_id INTEGER NOT NULL REFERENCES users(id),
        seller_id INTEGER NOT NULL REFERENCES users(id),
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        condition TEXT,
        comment TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS disputes (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        buyer_id INTEGER NOT NULL REFERENCES users(id),
        seller_id INTEGER NOT NULL REFERENCES users(id),
        reason TEXT NOT NULL,
        description TEXT,
        requested_resolution TEXT,
        status TEXT DEFAULT 'open',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(active)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_reviews_seller ON reviews(seller_id)');

    console.log('Database initialized');
  } finally { client.release(); }
}

function pg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + String(++i));
}

export const db = {
  async get(sql: string, ...params: any[]): Promise<any> {
    const res = await pool.query(pg(sql), params.flat());
    return res.rows[0] || undefined;
  },
  async all(sql: string, ...params: any[]): Promise<any[]> {
    const res = await pool.query(pg(sql), params.flat());
    return res.rows;
  },
  async run(sql: string, ...params: any[]): Promise<{ id: number; changes: number }> {
    const pgSql = pg(sql);
    const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
    const finalSql = isInsert && !pgSql.includes('RETURNING') ? pgSql + ' RETURNING id' : pgSql;
    const res = await pool.query(finalSql, params.flat());
    return { id: res.rows[0]?.id || 0, changes: res.rowCount || 0 };
  }
};

export default db;
