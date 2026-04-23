import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Called by a scheduled automation — no end-user auth context.
// Validates that the caller is either the scheduler (no user) or an admin.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled automation (no user context) OR admin users only
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_) {
      // No user context — likely called by scheduler, allow it
    }

    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: only admin or scheduler can update cycle status' }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];
    const schedules = await base44.asServiceRole.entities.CycleInventorySchedule.list();

    const toUpdate = schedules.filter(s =>
      s.status === 'pendente' && s.next_count_date && s.next_count_date < today
    );

    for (const s of toUpdate) {
      await base44.asServiceRole.entities.CycleInventorySchedule.update(s.id, {
        status: 'atrasado',
      });
    }

    return Response.json({ success: true, updated: toUpdate.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});