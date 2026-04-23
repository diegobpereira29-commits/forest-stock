import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── Config ────────────────────────────────────────────────────────────────────
const LOSS_THRESHOLD_BRL = 500;    // R$ 500 — alerta financeiro de perda
const MANUAL_ADJUST_DAYS = 7;      // janela de ajustes manuais
const MANUAL_ADJUST_MIN  = 3;      // mínimo de ajustes para alertar
const DEVIATION_PCT      = 1.15;   // 15% acima do planejado

function ymd(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function inRange(dateStr, startStr, endStr) {
  if (!dateStr || !startStr || !endStr) return false;
  const d = new Date(dateStr).getTime();
  return d >= new Date(startStr).getTime() && d <= new Date(endStr).getTime();
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  const base44 = createClientFromRequest(req);

  try {
    // Auth — allow admin or scheduled automation (no user header)
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    const isScheduled = !user;
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const today       = ymd(new Date());
    const sevenDaysAgo  = ymd(new Date(Date.now() - MANUAL_ADJUST_DAYS * 86400_000));
    const thirtyDaysAgo = ymd(new Date(Date.now() - 30 * 86400_000));

    // ── Fetch data in parallel ────────────────────────────────────────────────
    const [products, movements, plannings, adminUsers] = await Promise.all([
      base44.asServiceRole.entities.Product.list('-name', 500),
      base44.asServiceRole.entities.Movement.list('-date', 2000),
      base44.asServiceRole.entities.ProjectPlanning.list('-period_start', 1000),
      base44.asServiceRole.entities.User.filter({ role: 'admin' }, '-created_date', 50),
    ]);

    // Build indexes
    const prodById = Object.fromEntries(products.map(p => [p.id, p]));

    const recentMov = movements.filter(m => m.date >= thirtyDaysAgo);
    const adjusts7d = movements.filter(m => m.type === 'ajuste' && m.date >= sevenDaysAgo);
    const losses30d = movements.filter(m => m.type === 'perda'  && m.date >= thirtyDaysAgo);
    const saidas    = movements.filter(m => m.type === 'saida');

    const notifications = [];

    // ── CHECK 1: Classe A abaixo do mínimo → alerta crítico ──────────────────
    const classABelowMin = products.filter(
      p => p.inventory_class === 'A' && p.min_stock > 0 && p.current_stock <= p.min_stock && p.active !== false
    );
    for (const p of classABelowMin) {
      notifications.push({
        title: `⚠️ Estoque crítico — ${p.name}`,
        message: `Produto Classe A com estoque abaixo do mínimo. Atual: ${p.current_stock} ${p.unit} | Mínimo: ${p.min_stock} ${p.unit}. Antecipe o pedido ao fornecedor.`,
        type: 'info',
        reference_id: p.id,
      });
    }

    // ── CHECK 2: Desvio > 15% em projeto → alerta moderado ───────────────────
    const saidaIndex = {};
    for (const m of saidas) {
      const k = `${m.project_id || ''}__${m.product_id || ''}`;
      (saidaIndex[k] = saidaIndex[k] || []).push(m);
    }

    const deviationSeen = new Set();
    for (const p of plannings) {
      const planned = Number(p.planned_quantity || 0);
      if (planned <= 0) continue;
      const k   = `${p.project_id || ''}__${p.product_id || ''}`;
      const key = `${p.project_id}__${p.product_id}`;
      if (deviationSeen.has(key)) continue;
      const real = (saidaIndex[k] || [])
        .filter(m => inRange(m.date, p.period_start, p.period_end))
        .reduce((sum, m) => sum + Number(m.quantity || 0), 0);
      if (real > planned * DEVIATION_PCT) {
        deviationSeen.add(key);
        const prod = prodById[p.product_id];
        const pct  = ((real / planned - 1) * 100).toFixed(0);
        notifications.push({
          title: `📊 Desvio de planejamento — ${prod?.name || 'Produto'}`,
          message: `Consumo ${pct}% acima do planejado (real: ${real}, planejado: ${planned}) no projeto ${p.project_name || p.project_id}. Revise o planejamento.`,
          type: 'info',
          reference_id: p.id,
        });
      }
    }

    // ── CHECK 3: 3+ ajustes manuais em 7 dias → alerta de auditoria ──────────
    const adjustByProd = {};
    for (const m of adjusts7d) {
      adjustByProd[m.product_id] = (adjustByProd[m.product_id] || 0) + 1;
    }
    for (const [pid, cnt] of Object.entries(adjustByProd)) {
      if (cnt >= MANUAL_ADJUST_MIN) {
        const prod = prodById[pid];
        notifications.push({
          title: `🔍 Auditoria recomendada — ${prod?.name || 'Produto'}`,
          message: `${cnt} ajustes manuais registrados nos últimos ${MANUAL_ADJUST_DAYS} dias. Recomenda-se contagem física imediata para validar o estoque.`,
          type: 'info',
          reference_id: pid,
        });
      }
    }

    // ── CHECK 4: Perda acima de R$ X → alerta financeiro ─────────────────────
    const lossByProd = {};
    for (const m of losses30d) {
      const val = Number(m.total_value || 0);
      if (!lossByProd[m.product_id]) lossByProd[m.product_id] = { total: 0, qty: 0, name: m.product_name };
      lossByProd[m.product_id].total += val;
      lossByProd[m.product_id].qty   += Number(m.quantity || 0);
    }
    for (const [pid, data] of Object.entries(lossByProd)) {
      if (data.total >= LOSS_THRESHOLD_BRL) {
        notifications.push({
          title: `💸 Alerta financeiro — perda em ${data.name || 'Produto'}`,
          message: `Total de perdas nos últimos 30 dias: R$ ${data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${data.qty} unidades). Investigue a causa e tome medidas preventivas.`,
          type: 'info',
          reference_id: pid,
        });
      }
    }

    if (notifications.length === 0) {
      return Response.json({ status: 'ok', created: 0, elapsed_ms: Date.now() - t0 });
    }

    // ── Save notifications for all admin users ────────────────────────────────
    const recipients = adminUsers.length > 0 ? adminUsers : [];
    const toCreate = [];
    for (const notif of notifications) {
      for (const admin of recipients) {
        toCreate.push({ ...notif, user_email: admin.email, read: false });
      }
      // If no admins found, create one generic placeholder
      if (recipients.length === 0) {
        toCreate.push({ ...notif, user_email: 'system', read: false });
      }
    }

    // Batch create in groups of 20
    for (let i = 0; i < toCreate.length; i += 20) {
      await Promise.all(
        toCreate.slice(i, i + 20).map(n =>
          base44.asServiceRole.entities.Notification.create(n)
        )
      );
    }

    console.log(`[proactiveAlerts] Created ${toCreate.length} notifications in ${Date.now() - t0}ms`);

    return Response.json({
      status: 'ok',
      elapsed_ms: Date.now() - t0,
      notifications_created: toCreate.length,
      checks: {
        class_a_below_min: classABelowMin.length,
        plan_deviation: deviationSeen.size,
        manual_adjusts: Object.values(adjustByProd).filter(c => c >= MANUAL_ADJUST_MIN).length,
        financial_loss: Object.values(lossByProd).filter(d => d.total >= LOSS_THRESHOLD_BRL).length,
      },
    });

  } catch (error) {
    console.error(`[proactiveAlerts] Error:`, error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});