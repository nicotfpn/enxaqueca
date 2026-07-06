import { kv } from '@vercel/kv';

const USER_ID = 'default';

export default async function handler(req, res) {
  try {
    const { data } = req.query;

    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return res.status(400).json({ error: 'Parâmetros inválidos' });
    }

    const key = `crises:${USER_ID}:${data}`;

    switch (req.method) {
      case 'GET': {
        const crisis = await kv.get(key);
        if (!crisis) {
          return res.status(404).json({ error: 'Nenhum registro encontrado' });
        }
        return res.status(200).json(crisis);
      }

      case 'PUT': {
        const body = req.body;
        if (!body || typeof body.intensidade !== 'number') {
          return res.status(400).json({ error: 'Dados inválidos' });
        }
        await kv.set(key, {
          data: body.data || data,
          intensidade: body.intensidade,
          hora_inicio: body.hora_inicio || '',
          tomou_medicamento: !!body.tomou_medicamento,
          medicamentos: Array.isArray(body.medicamentos) ? body.medicamentos : [],
          foi_hospital: !!body.foi_hospital,
          teve_gatilho: !!body.teve_gatilho,
          gatilho: body.gatilho || ''
        });
        return res.status(200).json({ ok: true });
      }

      case 'DELETE': {
        await kv.del(key);
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Crisis error:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
