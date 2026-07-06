import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
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
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = Number(nextCursor);

      if (keys.length > 0) {
        const values = await redis.mget(...keys);
        for (let i = 0; i < keys.length; i++) {
          const date = keys[i].split(':')[2];
          crises[date] = values[i];
        }
      }
    } while (cursor !== 0);

    return res.status(200).json(crises);
  } catch (err) {
    if (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED') || err.message?.includes('fetch failed')) {
      return res.status(503).json({ error: 'Banco de dados (Redis) não configurado. Conecte o Upstash Redis no dashboard da Vercel.' });
    }
    console.error('Month error:', err);
    return res.status(500).json({ error: 'Erro interno ao buscar dados do mês' });
  }
}
