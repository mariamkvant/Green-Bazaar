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
        photos TEXT,
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

    // Favorites table
    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        listing_id INTEGER NOT NULL REFERENCES listings(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, listing_id)
      )
    `);

    // Notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        link TEXT,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Add new columns to listings for care guides, multi-image, planting season
    try { await client.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS images TEXT'); } catch(e) {}
    try { await client.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS watering TEXT'); } catch(e) {}
    try { await client.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS sunlight TEXT'); } catch(e) {}
    try { await client.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS soil TEXT'); } catch(e) {}
    try { await client.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS frost_tolerance TEXT'); } catch(e) {}
    try { await client.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS best_planting TEXT'); } catch(e) {}
    try { await client.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS delivery_fee INTEGER DEFAULT 0'); } catch(e) {}
    try { await client.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS delivery_note TEXT'); } catch(e) {}
    try { await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_code TEXT'); } catch(e) {}
    try { await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_expires TIMESTAMPTZ'); } catch(e) {}

    // Add verified badge fields to users
    try { await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_seller BOOLEAN DEFAULT false'); } catch(e) {}
    try { await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS completed_orders INTEGER DEFAULT 0'); } catch(e) {}
    try { await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false'); } catch(e) {}
    try { await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_code TEXT'); } catch(e) {}
    try { await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_expires TIMESTAMPTZ'); } catch(e) {}

    await client.query('CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)');

    // Seed sample data if empty
    const listingCount = await client.query('SELECT COUNT(*) as cnt FROM listings');
    if (parseInt(listingCount.rows[0].cnt) === 0) {
      console.log('Seeding sample data...');
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('seller123', 10);

      // Create sample sellers (use ON CONFLICT to avoid duplicates)
      const s1 = await client.query("INSERT INTO users (name, email, password, phone, city, type, bio) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name RETURNING id",
        ["Giorgi's Nursery", 'giorgi@bazaar.green', hash, '+995 555 123 456', 'Tbilisi', 'seller', 'Family-run nursery in Dighomi, Tbilisi. Growing Thuja and ornamental plants since 2018.']);
      const s2 = await client.query("INSERT INTO users (name, email, password, phone, city, type, bio) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name RETURNING id",
        ['Kakheti Green Farm', 'kakheti@bazaar.green', hash, '+995 577 234 567', 'Telavi, Kakheti', 'seller', 'Organic farm in the heart of Kakheti wine region. Specializing in fruit trees and hedges.']);
      const s3 = await client.query("INSERT INTO users (name, email, password, phone, city, type, bio) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name RETURNING id",
        ['Batumi Botanics', 'batumi@bazaar.green', hash, '+995 599 345 678', 'Batumi, Adjara', 'seller', 'Subtropical plant specialists near the Black Sea coast. Rare ornamentals and exotic varieties.']);
      const s4 = await client.query("INSERT INTO users (name, email, password, phone, city, type, bio) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name RETURNING id",
        ['Kutaisi Gardens', 'kutaisi@bazaar.green', hash, '+995 568 456 789', 'Kutaisi', 'seller', 'Central Georgia grower with 5 hectares of nursery. Wholesale and retail.']);

      const id1 = s1.rows[0].id, id2 = s2.rows[0].id, id3 = s3.rows[0].id, id4 = s4.rows[0].id;

      const listings: any[][] = [
        [id1, 'Thuja Smaragd (Emerald Green)', "Thuja occidentalis 'Smaragd'", 'thuja', 25, 'per plant', '80–100 cm', '3 years', 'available',
         'Classic pyramid-shaped Thuja with bright emerald foliage. Perfect for hedges and privacy screens. Grows well in Georgian climate, drought-tolerant once established.',
         'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600&h=400&fit=crop', '2-3 times/week in summer', 'Full sun to partial shade', 'Well-drained, slightly acidic', 'Hardy to -30°C', 'March–May or Sept–Nov'],
        [id1, 'Thuja Brabant (Fast Grower)', "Thuja occidentalis 'Brabant'", 'thuja', 20, 'per plant', '100–120 cm', '3–4 years', 'available',
         'The fastest growing Thuja variety — adds 30–40 cm per year. Dense foliage provides excellent privacy. Well-rooted and ready for transplanting.',
         'https://images.unsplash.com/photo-1598512752271-33f913a5af13?w=600&h=400&fit=crop', 'Regular watering first year', 'Full sun', 'Any well-drained soil', 'Hardy to -25°C', 'March–May'],
        [id2, 'Thuja Giant Green', "Thuja plicata 'Green Giant'", 'thuja', 35, 'per plant', '120–150 cm', '4 years', 'limited',
         'Premium large Thuja for instant impact. Dark green, dense foliage that stays vibrant year-round. Excellent wind resistance.',
         'https://images.unsplash.com/photo-1604762524889-3e2fcc145683?w=600&h=400&fit=crop', 'Weekly deep watering', 'Full sun to light shade', 'Rich, moist soil', 'Hardy to -20°C', 'Spring or early autumn'],
        [id1, 'Thuja Smaragd — Bulk Pack (10 pcs)', "Thuja occidentalis 'Smaragd'", 'thuja', 200, 'pack of 10', '60–80 cm', '2 years', 'available',
         'Budget-friendly bulk pack for creating a full hedge line. 10 healthy Smaragd saplings, perfect spacing for a 5-meter fence.',
         'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&h=400&fit=crop', '', '', '', '', 'March–May'],
        [id3, 'Thuja Golden Globe', "Thuja occidentalis 'Golden Globe'", 'thuja', 30, 'per plant', '40–50 cm', '3 years', 'available',
         'Compact, ball-shaped Thuja with stunning golden-yellow foliage. Perfect for garden borders, rock gardens, or decorative pots.',
         'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=600&h=400&fit=crop', 'Moderate', 'Full sun for best color', 'Well-drained', 'Hardy to -25°C', 'Spring'],
        [id3, 'Thuja Danica (Dwarf)', "Thuja occidentalis 'Danica'", 'thuja', 18, 'per plant', '30–40 cm', '2 years', 'available',
         'Adorable dwarf globe Thuja, perfect for small gardens, balconies, and container planting. Very hardy — handles Georgian winters with ease.',
         'https://images.unsplash.com/photo-1491147334573-44cbb4602074?w=600&h=400&fit=crop', 'Low to moderate', 'Sun to partial shade', 'Any soil', 'Hardy to -30°C', 'Any time spring–autumn'],
        [id2, 'Cherry Laurel Hedge', 'Prunus laurocerasus', 'hedge', 15, 'per plant', '60–80 cm', '2 years', 'available',
         'Glossy evergreen hedge plant, very popular in Georgian gardens. Fast growing with beautiful white spring flowers. Creates a dense, lush privacy screen.',
         'https://images.unsplash.com/photo-1462275646964-a0e3c11f18a6?w=600&h=400&fit=crop', 'Regular in dry spells', 'Sun to full shade', 'Any moist soil', 'Hardy to -15°C', 'Oct–March'],
        [id3, 'Japanese Maple (Red)', "Acer palmatum 'Atropurpureum'", 'ornamental', 65, 'per plant', '80–100 cm', '4 years', 'limited',
         'Stunning ornamental tree with deep red-purple leaves. A showpiece for any garden. Prefers partial shade and well-drained soil.',
         'https://images.unsplash.com/photo-1603912699214-92627f304eb6?w=600&h=400&fit=crop', 'Keep moist, not waterlogged', 'Partial shade', 'Acidic, well-drained', 'Hardy to -15°C', 'Autumn or spring'],
        [id2, 'Pomegranate Tree', 'Punica granatum', 'fruit', 40, 'per tree', '100–130 cm', '3 years', 'preorder',
         'Traditional Georgian pomegranate, fruit-bearing variety. Will produce fruit within 1–2 seasons. Loves the Georgian sun.',
         'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&h=400&fit=crop', 'Deep watering weekly', 'Full sun', 'Well-drained, tolerates poor soil', 'Hardy to -10°C', 'November'],
        [id1, 'Fig Tree (Brown Turkey)', "Ficus carica 'Brown Turkey'", 'fruit', 35, 'per tree', '90–110 cm', '3 years', 'available',
         'Reliable fig variety that thrives in Georgian climate. Sweet, juicy fruits ready by late summer. Self-pollinating — only one tree needed.',
         'https://images.unsplash.com/photo-1601379760883-1bb497c558e0?w=600&h=400&fit=crop', 'Moderate', 'Full sun, sheltered', 'Any well-drained', 'Hardy to -12°C', 'March–April'],
        [id4, 'Boxwood Hedge (Buxus)', "Buxus sempervirens", 'hedge', 12, 'per plant', '30–40 cm', '2 years', 'available',
         'Classic formal hedge plant. Dense, small-leaved evergreen perfect for borders, topiary, and low hedges. Slow growing but incredibly long-lived.',
         'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=400&fit=crop', 'Moderate', 'Sun to shade', 'Any well-drained', 'Hardy to -20°C', 'Spring or autumn'],
        [id4, 'Cypress Leyland', "× Cuprocyparis leylandii", 'hedge', 22, 'per plant', '100–140 cm', '3 years', 'available',
         'Fast-growing evergreen screen. Grows up to 1 meter per year. Creates a dense, tall privacy barrier quickly. Popular for large gardens.',
         'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=600&h=400&fit=crop', 'Regular first 2 years', 'Full sun', 'Any soil', 'Hardy to -15°C', 'March–May'],
        [id3, 'Magnolia Soulangeana', "Magnolia × soulangeana", 'ornamental', 85, 'per plant', '100–120 cm', '5 years', 'limited',
         'Breathtaking spring-flowering tree with large pink-white blooms. A statement piece for any garden. Flowers before leaves appear.',
         'https://images.unsplash.com/photo-1518882570534-731b39e2f46b?w=600&h=400&fit=crop', 'Regular, keep moist', 'Sun to light shade', 'Rich, acidic, well-drained', 'Hardy to -15°C', 'Autumn'],
        [id4, 'Lavender (Grosso)', "Lavandula × intermedia 'Grosso'", 'ornamental', 8, 'per plant', '20–30 cm', '1 year', 'available',
         'Fragrant Mediterranean herb with purple flower spikes. Attracts bees and butterflies. Drought-tolerant once established. Great for borders.',
         'https://images.unsplash.com/photo-1499002238440-d264edd596ec?w=600&h=400&fit=crop', 'Very low — drought tolerant', 'Full sun', 'Poor, sandy, well-drained', 'Hardy to -15°C', 'Spring'],
        [id2, 'Grape Vine (Saperavi)', "Vitis vinifera 'Saperavi'", 'fruit', 25, 'per vine', '80–100 cm', '2 years', 'available',
         'Georgia\'s most famous grape variety. Deep red wine grape, also excellent for eating. Strong grower, produces fruit in 2nd year after planting.',
         'https://images.unsplash.com/photo-1596363505729-4190a9506133?w=600&h=400&fit=crop', 'Deep watering in summer', 'Full sun', 'Well-drained, chalky', 'Hardy to -20°C', 'Dec–March (dormant)'],
        [id1, 'Olive Tree', "Olea europaea", 'fruit', 55, 'per tree', '80–100 cm', '4 years', 'limited',
         'Mediterranean beauty now thriving in Georgian lowlands. Produces olives in 3–4 years. Evergreen with beautiful silver-green foliage.',
         'https://images.unsplash.com/photo-1445282768818-728615cc910a?w=600&h=400&fit=crop', 'Low — very drought tolerant', 'Full sun', 'Poor, well-drained', 'Hardy to -10°C', 'Spring'],
      ];

      for (const l of listings) {
        await client.query(
          'INSERT INTO listings (seller_id, name, latin, category, price, unit, height, age, stock, description, image, watering, sunlight, soil, frost_tolerance, best_planting) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',
          l
        );
      }
      console.log('Seeded 4 sellers and 16 sample listings');
    }

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
