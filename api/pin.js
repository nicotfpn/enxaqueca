import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pin } = req.body;

    if (!pin || !/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({ error: 'PIN deve ter 4 dígitos numéricos' });
    }

    const key = `pin:${pin}`;
    const exists = await kv.exists(key);

    if (exists) {
      return res.status(200).json({ ok: true, action: 'login' });
    }

    await kv.set(key, { created_at: new Date().toISOString() });
    return res.status(201).json({ ok: true, action: 'created' });
  } catch (err) {
    console.error('PIN error:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
