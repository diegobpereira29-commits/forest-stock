import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
      return Response.json({ error: 'Forbidden: only admin can run ABC classification' }, { status: 403 });
    }

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const [products, movements] = await Promise.all([
      base44.asServiceRole.entities.Product.list(),
      base44.asServiceRole.entities.Movement.list(),
    ]);

    const activeProducts = products.filter(p => p.active !== false);
    const recentMovements = movements.filter(m => m.date && m.date >= cutoffStr);

    const stats = {};
    for (const p of activeProducts) {
      stats[p.id] = { vm: 0, fm: 0 };
    }
    for (const m of recentMovements) {
      if (stats[m.product_id] !== undefined) {
        stats[m.product_id].vm += m.total_value || 0;
        stats[m.product_id].fm += 1;
      }
    }

    const vmValues = activeProducts.map(p => stats[p.id]?.vm || 0);
    const fmValues = activeProducts.map(p => stats[p.id]?.fm || 0);

    const percentile = (arr, val) => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const maxVal = sorted[sorted.length - 1];
      if (maxVal === 0) return 0;
      return (val / maxVal) * 100;
    };

    const classifyProduct = (vm, fm, allVm, allFm) => {
      const vmP = percentile(allVm, vm);
      const fmP = percentile(allFm, fm);
      const score = (vmP * 0.6) + (fmP * 0.4);
      if (score >= 70) return { class: 'A', score, frequencyDays: 7 };
      if (score >= 40) return { class: 'B', score, frequencyDays: 15 };
      return { class: 'C', score, frequencyDays: 30 };
    };

    const today = now.toISOString().split('T')[0];
    const existingSchedules = await base44.asServiceRole.entities.CycleInventorySchedule.list();
    const scheduleByProduct = {};
    for (const s of existingSchedules) {
      scheduleByProduct[s.product_id] = s;
    }

    const classified = { A: 0, B: 0, C: 0 };

    for (const p of activeProducts) {
      const s = stats[p.id] || { vm: 0, fm: 0 };
      const result = classifyProduct(s.vm, s.fm, vmValues, fmValues);

      await base44.asServiceRole.entities.Product.update(p.id, {
        inventory_class: result.class,
      });

      classified[result.class]++;

      const existing = scheduleByProduct[p.id];

      if (existing) {
        const newNextDate = existing.last_count_date
          ? (() => {
              const d = new Date(existing.last_count_date);
              d.setDate(d.getDate() + result.frequencyDays);
              return d.toISOString().split('T')[0];
            })()
          : today;

        let status = existing.status;
        if (newNextDate < today && status !== 'realizado') status = 'atrasado';

        await base44.asServiceRole.entities.CycleInventorySchedule.update(existing.id, {
          inventory_class: result.class,
          frequency_days: result.frequencyDays,
          next_count_date: newNextDate,
          product_name: p.name,
          product_category: p.category,
          status,
        });
      } else {
        const nextDate = new Date(now);
        nextDate.setDate(nextDate.getDate() + result.frequencyDays);
        await base44.asServiceRole.entities.CycleInventorySchedule.create({
          product_id: p.id,
          product_name: p.name,
          product_category: p.category,
          inventory_class: result.class,
          frequency_days: result.frequencyDays,
          next_count_date: nextDate.toISOString().split('T')[0],
          status: 'pendente',
        });
      }
    }

    return Response.json({
      success: true,
      total: activeProducts.length,
      classified,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});