import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pin, year, month } = req.query;

    const pinExists = await kv.exists(`pin:${pin}`);
    if (!pinExists) {
      return res.status(401).json({ error: 'PIN inválido' });
    }

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const pattern = `crises:${pin}:${monthStr}-*`;

    let cursor = 0;
    const crises = {};

    do {
      const [nextCursor, keys] = await kv.scan(cursor, { match: pattern, count: 100 });
      cursor = nextCursor;

      if (keys.length > 0) {
        const values = await kv.mget(...keys);
        for (let i = 0; i < keys.length; i++) {
          const date = keys[i].split(':')[2];
          crises[date] = values[i];
        }
      }
    } while (cursor !== 0);

    return res.status(200).json(crises);
  } catch (err) {
    console.error('Month error:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
