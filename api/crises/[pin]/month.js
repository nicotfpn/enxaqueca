import { kv } from '@vercel/kv';

const USER_ID = 'default';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { year, month } = req.query;

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const pattern = `crises:${USER_ID}:${monthStr}-*`;

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
