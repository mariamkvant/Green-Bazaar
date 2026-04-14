import { Router } from 'express';
import db from '../database';

const router = Router();

// Manual seed endpoint — call once to populate sample data
router.post('/seed', async (_req, res) => {
  try {
    const existing = await db.get('SELECT COUNT(*) as cnt FROM listings WHERE seller_id IN (SELECT id FROM users WHERE email LIKE $1)', '%@bazaar.green');
    if (existing && parseInt(existing.cnt) > 0) return res.json({ message: 'Already seeded', count: existing.cnt });

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('seller123', 10);

    const sellers = [
      ["Giorgi's Nursery", 'giorgi@bazaar.green', hash, '+995 555 123 456', 'Tbilisi', 'seller', 'Family-run nursery in Dighomi, Tbilisi. Growing Thuja and ornamental plants since 2018.'],
      ['Kakheti Green Farm', 'kakheti@bazaar.green', hash, '+995 577 234 567', 'Telavi, Kakheti', 'seller', 'Organic farm in the heart of Kakheti. Specializing in fruit trees and hedges.'],
      ['Batumi Botanics', 'batumi@bazaar.green', hash, '+995 599 345 678', 'Batumi, Adjara', 'seller', 'Subtropical plant specialists near the Black Sea coast.'],
      ['Kutaisi Gardens', 'kutaisi@bazaar.green', hash, '+995 568 456 789', 'Kutaisi', 'seller', 'Central Georgia grower with 5 hectares of nursery.'],
    ];

    const ids: number[] = [];
    for (const s of sellers) {
      const r = await db.run("INSERT INTO users (name, email, password, phone, city, type, bio) VALUES (?,?,?,?,?,?,?) ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name RETURNING id", ...s);
      ids.push(r.id);
    }

    const [id1, id2, id3, id4] = ids;
    const listings = [
      [id1, 'Thuja Smaragd (Emerald Green)', "Thuja occidentalis 'Smaragd'", 'thuja', 25, 'per plant', '80–100 cm', '3 years', 'available', 'Classic pyramid-shaped Thuja with bright emerald foliage. Perfect for hedges and privacy screens.', 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600&h=400&fit=crop', '2-3 times/week in summer', 'Full sun to partial shade', 'Well-drained, slightly acidic', 'Hardy to -30°C', 'March–May or Sept–Nov'],
      [id1, 'Thuja Brabant (Fast Grower)', "Thuja occidentalis 'Brabant'", 'thuja', 20, 'per plant', '100–120 cm', '3–4 years', 'available', 'Fastest growing Thuja — adds 30–40 cm per year. Dense foliage, excellent privacy.', 'https://images.unsplash.com/photo-1598512752271-33f913a5af13?w=600&h=400&fit=crop', 'Regular first year', 'Full sun', 'Any well-drained', 'Hardy to -25°C', 'March–May'],
      [id2, 'Thuja Giant Green', "Thuja plicata 'Green Giant'", 'thuja', 35, 'per plant', '120–150 cm', '4 years', 'limited', 'Premium large Thuja for instant impact. Dark green, vibrant year-round.', 'https://images.unsplash.com/photo-1604762524889-3e2fcc145683?w=600&h=400&fit=crop', 'Weekly deep watering', 'Full sun to light shade', 'Rich, moist soil', 'Hardy to -20°C', 'Spring or early autumn'],
      [id1, 'Thuja Smaragd — Bulk Pack (10 pcs)', "Thuja occidentalis 'Smaragd'", 'thuja', 200, 'pack of 10', '60–80 cm', '2 years', 'available', 'Budget-friendly bulk pack for a full hedge line. 10 saplings for a 5-meter fence.', 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&h=400&fit=crop', '', '', '', '', 'March–May'],
      [id3, 'Thuja Golden Globe', "Thuja occidentalis 'Golden Globe'", 'thuja', 30, 'per plant', '40–50 cm', '3 years', 'available', 'Compact ball-shaped Thuja with golden-yellow foliage. Perfect for borders and pots.', 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=600&h=400&fit=crop', 'Moderate', 'Full sun for best color', 'Well-drained', 'Hardy to -25°C', 'Spring'],
      [id3, 'Thuja Danica (Dwarf)', "Thuja occidentalis 'Danica'", 'thuja', 18, 'per plant', '30–40 cm', '2 years', 'available', 'Adorable dwarf globe Thuja for small gardens and balconies. Very hardy.', 'https://images.unsplash.com/photo-1491147334573-44cbb4602074?w=600&h=400&fit=crop', 'Low to moderate', 'Sun to partial shade', 'Any soil', 'Hardy to -30°C', 'Spring–autumn'],
      [id2, 'Cherry Laurel Hedge', 'Prunus laurocerasus', 'hedge', 15, 'per plant', '60–80 cm', '2 years', 'available', 'Glossy evergreen hedge, very popular in Georgian gardens. Fast growing.', 'https://images.unsplash.com/photo-1462275646964-a0e3c11f18a6?w=600&h=400&fit=crop', 'Regular in dry spells', 'Sun to full shade', 'Any moist soil', 'Hardy to -15°C', 'Oct–March'],
      [id3, 'Japanese Maple (Red)', "Acer palmatum 'Atropurpureum'", 'ornamental', 65, 'per plant', '80–100 cm', '4 years', 'limited', 'Stunning ornamental with deep red-purple leaves. A garden showpiece.', 'https://images.unsplash.com/photo-1603912699214-92627f304eb6?w=600&h=400&fit=crop', 'Keep moist', 'Partial shade', 'Acidic, well-drained', 'Hardy to -15°C', 'Autumn or spring'],
      [id2, 'Pomegranate Tree', 'Punica granatum', 'fruit', 40, 'per tree', '100–130 cm', '3 years', 'preorder', 'Traditional Georgian pomegranate. Fruit-bearing in 1–2 seasons.', 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&h=400&fit=crop', 'Deep watering weekly', 'Full sun', 'Well-drained', 'Hardy to -10°C', 'November'],
      [id1, 'Fig Tree (Brown Turkey)', "Ficus carica 'Brown Turkey'", 'fruit', 35, 'per tree', '90–110 cm', '3 years', 'available', 'Reliable fig for Georgian climate. Sweet fruits by late summer. Self-pollinating.', 'https://images.unsplash.com/photo-1601379760883-1bb497c558e0?w=600&h=400&fit=crop', 'Moderate', 'Full sun, sheltered', 'Any well-drained', 'Hardy to -12°C', 'March–April'],
      [id4, 'Boxwood Hedge (Buxus)', 'Buxus sempervirens', 'hedge', 12, 'per plant', '30–40 cm', '2 years', 'available', 'Classic formal hedge. Dense, small-leaved evergreen for borders and topiary.', 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=400&fit=crop', 'Moderate', 'Sun to shade', 'Any well-drained', 'Hardy to -20°C', 'Spring or autumn'],
      [id4, 'Cypress Leyland', '× Cuprocyparis leylandii', 'hedge', 22, 'per plant', '100–140 cm', '3 years', 'available', 'Fast-growing evergreen screen. Up to 1m per year. Dense privacy barrier.', 'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=600&h=400&fit=crop', 'Regular first 2 years', 'Full sun', 'Any soil', 'Hardy to -15°C', 'March–May'],
      [id3, 'Magnolia Soulangeana', 'Magnolia × soulangeana', 'ornamental', 85, 'per plant', '100–120 cm', '5 years', 'limited', 'Breathtaking spring-flowering tree with large pink-white blooms.', 'https://images.unsplash.com/photo-1518882570534-731b39e2f46b?w=600&h=400&fit=crop', 'Regular, keep moist', 'Sun to light shade', 'Rich, acidic', 'Hardy to -15°C', 'Autumn'],
      [id4, 'Lavender (Grosso)', "Lavandula × intermedia 'Grosso'", 'ornamental', 8, 'per plant', '20–30 cm', '1 year', 'available', 'Fragrant purple flower spikes. Attracts bees. Drought-tolerant.', 'https://images.unsplash.com/photo-1499002238440-d264edd596ec?w=600&h=400&fit=crop', 'Very low', 'Full sun', 'Poor, sandy', 'Hardy to -15°C', 'Spring'],
      [id2, 'Grape Vine (Saperavi)', "Vitis vinifera 'Saperavi'", 'fruit', 25, 'per vine', '80–100 cm', '2 years', 'available', "Georgia's famous grape. Deep red wine grape, also great for eating.", 'https://images.unsplash.com/photo-1596363505729-4190a9506133?w=600&h=400&fit=crop', 'Deep watering in summer', 'Full sun', 'Well-drained, chalky', 'Hardy to -20°C', 'Dec–March'],
      [id1, 'Olive Tree', 'Olea europaea', 'fruit', 55, 'per tree', '80–100 cm', '4 years', 'limited', 'Mediterranean beauty thriving in Georgian lowlands. Produces olives in 3–4 years.', 'https://images.unsplash.com/photo-1445282768818-728615cc910a?w=600&h=400&fit=crop', 'Low — drought tolerant', 'Full sun', 'Poor, well-drained', 'Hardy to -10°C', 'Spring'],
    ];

    for (const l of listings) {
      await db.run('INSERT INTO listings (seller_id, name, latin, category, price, unit, height, age, stock, description, image, watering, sunlight, soil, frost_tolerance, best_planting) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', ...l);
    }

    res.json({ message: 'Seeded 4 sellers and 16 listings', count: listings.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
