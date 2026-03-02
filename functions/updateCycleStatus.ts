import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// This function is called by a scheduled automation every day
// It updates overdue cycle inventory schedules
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

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