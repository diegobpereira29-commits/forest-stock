import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch all needed data in parallel
    const [products, movements, inventories, auditAlerts, changeRequests] = await Promise.all([
      base44.asServiceRole.entities.Product.list('-name', 1000),
      base44.asServiceRole.entities.Movement.list('-date', 500),
      base44.asServiceRole.entities.Inventory.filter({ status: 'pendente' }, '-date', 500),
      base44.asServiceRole.entities.AuditAlert.filter({ status: 'open', type: 'unplanned_out' }, '-created_date', 500),
      base44.asServiceRole.entities.MovementChangeRequest.filter({ status: 'pendente' }, '-created_date', 200),
    ]);

    const activeProducts = products.filter(p => p.active !== false);
    const total = activeProducts.length;

    // ── 1. Below minimum stock (30%) ──────────────────────────────────────
    const belowMin = activeProducts.filter(p => p.min_stock > 0 && p.current_stock <= p.min_stock).length;
    const belowMinPct = total > 0 ? (belowMin / total) * 100 : 0;

    // ── 2. Losses in last 60 days (20%) ───────────────────────────────────
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    const losses60 = movements.filter(m => m.type === 'perda' && m.date >= sixtyDaysAgo);
    // Penalty: 0% losses = 0 penalty, ≥10 losses = 100% penalty (capped)
    const lossPct = Math.min(100, (losses60.length / 10) * 100);

    // ── 3. Inventory divergence (20%) ─────────────────────────────────────
    // Pending inventories with non-zero difference
    const divs = inventories.filter(i => i.difference !== 0 && i.difference != null);
    // Penalty: 0 divergences = 0, ≥ 20 = 100%
    const divPct = Math.min(100, (divs.length / 20) * 100);

    // ── 4. Unplanned exits (20%) ──────────────────────────────────────────
    const saidas = movements.filter(m => m.type === 'saida');
    // Use open unplanned_out alerts relative to recent exits
    const unplannedPct = saidas.length > 0
      ? Math.min(100, (auditAlerts.length / saidas.length) * 100)
      : 0;

    // ── 5. Pending change requests (10%) ──────────────────────────────────
    // Penalty: 0 = 0, ≥ 15 = 100%
    const pendingPct = Math.min(100, (changeRequests.length / 15) * 100);

    // ── Score calculation ─────────────────────────────────────────────────
    const score =
      (1 - belowMinPct / 100) * 30 +
      (1 - lossPct / 100) * 20 +
      (1 - divPct / 100) * 20 +
      (1 - unplannedPct / 100) * 20 +
      (1 - pendingPct / 100) * 10;

    const finalScore = Math.max(0, Math.min(100, score));

    const classification =
      finalScore >= 85 ? 'saudavel' : finalScore >= 70 ? 'atencao' : 'risco';

    return Response.json({
      score: finalScore,
      classification,
      details: {
        below_min: belowMinPct,
        losses: lossPct,
        inventory_div: divPct,
        unplanned: unplannedPct,
        pending_requests: pendingPct,
      },
      computed_at: new Date().toISOString(),
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});