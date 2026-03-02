import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Config ───────────────────────────────────────────────────────────────────
const MAX_MOVEMENTS   = 10000;  // hard cap per run
const MAX_PLANNINGS   = 5000;
const PAGE_SIZE       = 500;    // records per fetch page
const ALERT_BATCH     = 20;     // concurrent alert upserts
const SENSITIVE_THRESHOLD = 3;  // adjustments in 60 days
const DEVIATION_PCT   = 1.15;   // 15% over plan triggers alert

// ── Helpers ──────────────────────────────────────────────────────────────────
function ymd(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function inRange(dateStr, startStr, endStr) {
  if (!dateStr || !startStr || !endStr) return false;
  const d = new Date(dateStr).getTime();
  return d >= new Date(startStr).getTime() && d <= new Date(endStr).getTime();
}

// Fetch all pages up to maxRecords using skip-based pagination
async function fetchAll(entityFn, sort, maxRecords) {
  const results = [];
  let skip = 0;
  while (results.length < maxRecords) {
    const batch = await entityFn(sort, PAGE_SIZE, skip);
    if (!batch || batch.length === 0) break;
    results.push(...batch);
    if (batch.length < PAGE_SIZE) break;     // last page
    skip += PAGE_SIZE;
    if (results.length >= maxRecords) break;
  }
  return results.slice(0, maxRecords);
}

// Run an array of async tasks in controlled concurrency batches
async function batchRun(items, concurrency, fn) {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(fn));
  }
}

// ── Alert upsert (pure data, no I/O outside) ─────────────────────────────────
function buildAlertOps(existingMap, today, alertPayloads) {
  const updates = [];
  const creates = [];
  for (const { key, payload } of alertPayloads) {
    if (existingMap[key]) {
      updates.push({ id: existingMap[key], payload: { ...payload, last_detected_at: today, status: 'open' } });
    } else {
      creates.push({ ...payload, detected_at: today, last_detected_at: today, status: 'open' });
    }
  }
  return { updates, creates };
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  const base44 = createClientFromRequest(req);

  try {
    // 1. Auth
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });

    const today = ymd(new Date());
    const sixtyDaysAgo = ymd(new Date(Date.now() - 60 * 86400_000));

    // 2. Parallel bulk fetch — paginated
    console.log('[runAudit] Fetching data...');
    const tFetch = Date.now();

    const [movements, plannings, products, teams, projects, existingAlerts] = await Promise.all([
      fetchAll((sort, limit, skip) => base44.asServiceRole.entities.Movement.list(sort, limit, skip), '-date', MAX_MOVEMENTS),
      fetchAll((sort, limit, skip) => base44.asServiceRole.entities.ProjectPlanning.list(sort, limit, skip), '-period_start', MAX_PLANNINGS),
      fetchAll((sort, limit, skip) => base44.asServiceRole.entities.Product.list(sort, limit, skip), '-name', 5000),
      base44.asServiceRole.entities.Team.list('-name', 500),
      base44.asServiceRole.entities.Project.list('-start_date', 500),
      base44.asServiceRole.entities.AuditAlert.filter({ status: 'open' }, '-created_date', 5000),
    ]);

    console.log(`[runAudit] Fetch done in ${Date.now() - tFetch}ms — movements:${movements.length} plannings:${plannings.length} products:${products.length}`);

    // 3. Build in-memory indexes (O(n) lookups)
    const prodById  = Object.fromEntries(products.map(p => [p.id, p]));
    const teamById  = Object.fromEntries(teams.map(t => [t.id, t]));
    const projById  = Object.fromEntries(projects.map(p => [p.id, p]));

    // Planning index: "projectId__productId" → [{...}]
    const planIndex = {};
    for (const p of plannings) {
      const key = `${p.project_id || ''}__${p.product_id || ''}`;
      (planIndex[key] = planIndex[key] || []).push(p);
    }

    // Existing alerts index by composite key for fast upsert decision
    const alertByMovement   = {};  // movement_id → alert id   (unplanned_out)
    const alertByComposite  = {};  // composite_key → alert id  (plan_deviation)
    const alertByProduct    = {};  // product_id → alert id     (sensitive_product)
    const alertByTeam       = {};  // team_id → alert id        (team_risk)
    for (const a of existingAlerts) {
      if (a.type === 'unplanned_out'    && a.movement_id)    alertByMovement[a.movement_id]    = a.id;
      if (a.type === 'plan_deviation'   && a.composite_key)  alertByComposite[a.composite_key] = a.id;
      if (a.type === 'sensitive_product'&& a.product_id)     alertByProduct[a.product_id]      = a.id;
      if (a.type === 'team_risk'        && a.team_id)        alertByTeam[a.team_id]            = a.id;
    }

    // 4. Pre-filter movement sets
    const saidas    = movements.filter(m => m.type === 'saida');
    const ajustes60 = movements.filter(m => m.type === 'ajuste' && m.date >= sixtyDaysAgo);
    const perdas60  = movements.filter(m => m.type === 'perda'  && m.date >= sixtyDaysAgo);

    // ── CHECK 1: Unplanned exits ─────────────────────────────────────────────
    const tC1 = Date.now();
    const unplannedPayloads = [];
    for (const m of saidas) {
      const key   = `${m.project_id || ''}__${m.product_id || ''}`;
      const plans = planIndex[key] || [];
      if (!plans.some(p => inRange(m.date, p.period_start, p.period_end))) {
        const prod = prodById[m.product_id];
        const proj = projById[m.project_id];
        const team = teamById[m.team_id];
        unplannedPayloads.push({
          key: m.id,   // keyed by movement_id for unplanned_out
          existingId: alertByMovement[m.id],
          payload: {
            type: 'unplanned_out',
            severity: 'medium',
            description: `Saída sem planejamento: ${prod?.name || 'Produto'} → ${proj?.name || 'Projeto'} em ${m.date}`,
            movement_id: m.id,
            product_id: m.product_id,
            product_name: prod?.name || '',
            project_id: m.project_id || '',
            project_name: proj?.name || '',
            team_id: m.team_id || '',
            team_name: team?.name || '',
          },
        });
      }
    }
    console.log(`[runAudit] Check 1 (unplanned) in ${Date.now() - tC1}ms — ${unplannedPayloads.length} alerts`);

    // ── CHECK 2: Plan deviation ──────────────────────────────────────────────
    const tC2 = Date.now();
    const deviationPayloads = [];

    // Build saidas lookup: "projectId__productId" → [{date, quantity}]
    const saidaIndex = {};
    for (const m of saidas) {
      const k = `${m.project_id || ''}__${m.product_id || ''}`;
      (saidaIndex[k] = saidaIndex[k] || []).push(m);
    }

    for (const p of plannings) {
      const planned = Number(p.planned_quantity || 0);
      if (planned <= 0) continue;
      const k    = `${p.project_id || ''}__${p.product_id || ''}`;
      const real = (saidaIndex[k] || [])
        .filter(m => inRange(m.date, p.period_start, p.period_end))
        .reduce((sum, m) => sum + Number(m.quantity || 0), 0);
      if (real > planned * DEVIATION_PCT) {
        const prod      = prodById[p.product_id];
        const proj      = projById[p.project_id];
        const composite = `${p.project_id}__${p.product_id}__${p.period_start}__${p.period_end}`;
        deviationPayloads.push({
          key: composite,
          existingId: alertByComposite[composite],
          payload: {
            type: 'plan_deviation',
            severity: 'high',
            description: `Desvio: ${prod?.name || 'Produto'} em ${proj?.name || 'Projeto'} — Real ${real} vs Planejado ${planned} (${((real / planned) * 100).toFixed(0)}%)`,
            composite_key: composite,
            product_id: p.product_id,
            product_name: prod?.name || '',
            project_id: p.project_id,
            project_name: proj?.name || '',
          },
        });
      }
    }
    console.log(`[runAudit] Check 2 (deviation) in ${Date.now() - tC2}ms — ${deviationPayloads.length} alerts`);

    // ── CHECK 3: Sensitive products (>3 adjustments in 60d) ──────────────────
    const tC3 = Date.now();
    const ajustesByProd = {};
    for (const m of ajustes60) {
      ajustesByProd[m.product_id] = (ajustesByProd[m.product_id] || 0) + 1;
    }
    const sensitivePayloads = [];
    for (const [pid, cnt] of Object.entries(ajustesByProd)) {
      if (cnt > SENSITIVE_THRESHOLD) {
        const prod = prodById[pid];
        sensitivePayloads.push({
          key: pid,
          existingId: alertByProduct[pid],
          payload: {
            type: 'sensitive_product',
            severity: 'high',
            description: `Produto sensível: ${prod?.name || 'Produto'} — ${cnt} ajustes nos últimos 60 dias`,
            product_id: pid,
            product_name: prod?.name || '',
          },
        });
      }
    }
    console.log(`[runAudit] Check 3 (sensitive) in ${Date.now() - tC3}ms — ${sensitivePayloads.length} alerts`);

    // ── CHECK 4: Team operational risk ───────────────────────────────────────
    const tC4 = Date.now();
    const perdasByTeam = {};
    for (const m of perdas60) {
      if (!m.team_id) continue;
      perdasByTeam[m.team_id] = (perdasByTeam[m.team_id] || 0) + Number(m.quantity || 0);
    }
    const teamValues = Object.values(perdasByTeam);
    const avg = teamValues.length > 0 ? teamValues.reduce((a, b) => a + b, 0) / teamValues.length : 0;
    const teamRiskPayloads = [];
    for (const [tid, val] of Object.entries(perdasByTeam)) {
      if (avg > 0 && val > avg) {
        const team = teamById[tid];
        teamRiskPayloads.push({
          key: tid,
          existingId: alertByTeam[tid],
          payload: {
            type: 'team_risk',
            severity: 'medium',
            description: `Risco operacional: equipe ${team?.name || tid} com perdas ${val.toFixed(2)} acima da média (${avg.toFixed(2)}) nos últimos 60 dias`,
            team_id: tid,
            team_name: team?.name || '',
          },
        });
      }
    }
    console.log(`[runAudit] Check 4 (team risk) in ${Date.now() - tC4}ms — ${teamRiskPayloads.length} alerts`);

    // ── Batch upsert all alerts ──────────────────────────────────────────────
    const tWrite = Date.now();
    const allPayloads = [...unplannedPayloads, ...deviationPayloads, ...sensitivePayloads, ...teamRiskPayloads];

    await batchRun(allPayloads, ALERT_BATCH, async ({ existingId, payload }) => {
      if (existingId) {
        await base44.asServiceRole.entities.AuditAlert.update(existingId, {
          ...payload,
          last_detected_at: today,
          status: 'open',
        });
      } else {
        await base44.asServiceRole.entities.AuditAlert.create({
          ...payload,
          detected_at: today,
          last_detected_at: today,
          status: 'open',
        });
      }
    });

    const elapsed = Date.now() - t0;
    console.log(`[runAudit] Alert writes done in ${Date.now() - tWrite}ms — total elapsed: ${elapsed}ms`);

    return Response.json({
      status: 'ok',
      elapsed_ms: elapsed,
      processed: {
        movements: movements.length,
        plannings: plannings.length,
        products: products.length,
      },
      summary: {
        unplanned_out:     unplannedPayloads.length,
        plan_deviation:    deviationPayloads.length,
        sensitive_product: sensitivePayloads.length,
        team_risk:         teamRiskPayloads.length,
        total_alerts:      allPayloads.length,
      },
    });

  } catch (error) {
    console.error(`[runAudit] Error after ${Date.now() - t0}ms:`, error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});