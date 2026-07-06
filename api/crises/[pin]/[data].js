import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
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
        const crisis = await redis.get(key);
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
        await redis.set(key, {
          data: body.data || data,
          intensidade: body.intensidade,
          hora_inicio: body.hora_inicio || '',
          hora_fim: body.hora_fim || '',
          em_andamento: !!body.em_andamento,
          tomou_medicamento: !!body.tomou_medicamento,
          medicamentos: Array.isArray(body.medicamentos) ? body.medicamentos : [],
          eficacia: body.eficacia || '',
          sintomas: Array.isArray(body.sintomas) ? body.sintomas : [],
          piora_atividade: body.piora_atividade || '',
          foi_hospital: !!body.foi_hospital,
          impacto_dia: !!body.impacto_dia,
          teve_gatilho: !!body.teve_gatilho,
          gatilho: body.gatilho || ''
        });
        return res.status(200).json({ ok: true });
      }

      case 'DELETE': {
        await redis.del(key);
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    if (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED') || err.message?.includes('fetch failed')) {
      return res.status(503).json({ error: 'Banco de dados (Redis) não configurado. Conecte o Upstash Redis no dashboard da Vercel.' });
    }
    console.error('Crisis error:', err);
    return res.status(500).json({ error: 'Erro interno ao processar crise' });
  }
}
