import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function ymd(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function inRange(dateStr, startStr, endStr) {
  if (!dateStr || !startStr || !endStr) return false;
  const d = new Date(dateStr).getTime();
  const s = new Date(startStr).getTime();
  const e = new Date(endStr).getTime();
  return d >= s && d <= e;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Authentication check
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Role-based access control — admin only
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: only admin can run audit' }, { status: 403 });
    }

    const [movements, plannings, products, teams, projects] = await Promise.all([
      base44.entities.Movement.list('-date', 2000),
      base44.entities.ProjectPlanning.list('-period_start', 1000),
      base44.entities.Product.list('-updated_date', 1000),
      base44.entities.Team.list('-name', 500),
      base44.entities.Project.list('-start_date', 500),
    ]);

    const prodById = Object.fromEntries(products.map(p => [p.id, p]));
    const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
    const projById = Object.fromEntries(projects.map(p => [p.id, p]));

    const planIndex = {};
    for (const p of plannings) {
      const key = `${p.project_id || ''}__${p.product_id || ''}`;
      if (!planIndex[key]) planIndex[key] = [];
      planIndex[key].push(p);
    }

    const today = new Date();
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(today.getDate() - 60);
    const sixtyStr = ymd(sixtyDaysAgo);

    const saidas = movements.filter(m => m.type === 'saida');
    const ajustes60 = movements.filter(m => m.type === 'ajuste' && m.date >= sixtyStr);
    const perdas60 = movements.filter(m => m.type === 'perda' && m.date >= sixtyStr);

    async function ensureAlert(where, payload) {
      const existing = await base44.entities.AuditAlert.filter(where, '-created_date', 1);
      if (existing && existing.length > 0) {
        const a = existing[0];
        await base44.entities.AuditAlert.update(a.id, {
          ...payload,
          last_detected_at: ymd(today),
          status: 'open',
        });
        return a.id;
      } else {
        const created = await base44.entities.AuditAlert.create({
          ...payload,
          detected_at: ymd(today),
          last_detected_at: ymd(today),
          status: 'open',
        });
        return created.id;
      }
    }

    // 1) Saída não planejada
    let unplannedCount = 0;
    for (const m of saidas) {
      const key = `${m.project_id || ''}__${m.product_id || ''}`;
      const plans = planIndex[key] || [];
      const hasPlan = plans.some(p => inRange(m.date, p.period_start, p.period_end));
      if (!hasPlan) {
        unplannedCount++;
        const prod = prodById[m.product_id];
        const proj = projById[m.project_id];
        const team = teamById[m.team_id];
        await ensureAlert(
          { type: 'unplanned_out', movement_id: m.id },
          {
            type: 'unplanned_out',
            severity: 'medium',
            description: `Saída sem planejamento: ${prod?.name || 'Produto'} → ${proj?.name || 'Projeto'} em ${m.date}`,
            movement_id: m.id,
            product_id: m.product_id,
            product_name: prod?.name || '',
            project_id: m.project_id,
            project_name: proj?.name || '',
            team_id: m.team_id || '',
            team_name: team?.name || '',
          }
        );
      }
    }

    // 2) Desvio de planejamento (> 15% acima)
    let deviationCount = 0;
    for (const p of plannings) {
      const real = saidas
        .filter(m => m.project_id === p.project_id && m.product_id === p.product_id && inRange(m.date, p.period_start, p.period_end))
        .reduce((sum, m) => sum + Number(m.quantity || 0), 0);
      const planned = Number(p.planned_quantity || 0);
      if (planned > 0 && real > planned * 1.15) {
        deviationCount++;
        const prod = prodById[p.product_id];
        const proj = projById[p.project_id];
        const composite = `${p.project_id}__${p.product_id}__${p.period_start}__${p.period_end}`;
        await ensureAlert(
          { type: 'plan_deviation', composite_key: composite },
          {
            type: 'plan_deviation',
            severity: 'high',
            description: `Desvio: ${prod?.name || 'Produto'} em ${proj?.name || 'Projeto'} — Real ${real} vs Planejado ${planned} (${((real / planned) * 100).toFixed(0)}%)`,
            composite_key: composite,
            product_id: p.product_id,
            product_name: prod?.name || '',
            project_id: p.project_id,
            project_name: proj?.name || '',
          }
        );
      }
    }

    // 3) Produto sensível (>3 ajustes em 60 dias)
    let sensitiveCount = 0;
    const ajustesByProd = {};
    for (const m of ajustes60) {
      if (!ajustesByProd[m.product_id]) ajustesByProd[m.product_id] = 0;
      ajustesByProd[m.product_id] += 1;
    }
    for (const [pid, cnt] of Object.entries(ajustesByProd)) {
      if (cnt > 3) {
        sensitiveCount++;
        const prod = prodById[pid];
        await ensureAlert(
          { type: 'sensitive_product', product_id: pid },
          {
            type: 'sensitive_product',
            severity: 'high',
            description: `Produto sensível: ${prod?.name || 'Produto'} — ${cnt} ajustes nos últimos 60 dias`,
            product_id: pid,
            product_name: prod?.name || '',
          }
        );
      }
    }

    // 4) Risco operacional por equipe (perdas acima da média em 60 dias)
    let teamRiskCount = 0;
    const perdasByTeam = {};
    for (const m of perdas60) {
      if (!m.team_id) continue;
      if (!perdasByTeam[m.team_id]) perdasByTeam[m.team_id] = 0;
      perdasByTeam[m.team_id] += Number(m.quantity || 0);
    }
    const teamValues = Object.values(perdasByTeam);
    const avg = teamValues.length > 0 ? teamValues.reduce((a, b) => a + b, 0) / teamValues.length : 0;
    for (const [tid, val] of Object.entries(perdasByTeam)) {
      if (val > avg && avg > 0) {
        teamRiskCount++;
        const team = teamById[tid];
        await ensureAlert(
          { type: 'team_risk', team_id: tid },
          {
            type: 'team_risk',
            severity: 'medium',
            description: `Risco operacional: equipe ${team?.name || tid} com perdas ${val.toFixed(2)} acima da média (${avg.toFixed(2)}) nos últimos 60 dias`,
            team_id: tid,
            team_name: team?.name || '',
          }
        );
      }
    }

    return Response.json({
      status: 'ok',
      summary: {
        unplanned_out: unplannedCount,
        plan_deviation: deviationCount,
        sensitive_product: sensitiveCount,
        team_risk: teamRiskCount,
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});