import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { request_id, action, reviewer_notes } = body;

    // Fetch change request
    const changeRequest = await base44.entities.MovementChangeRequest.read(request_id);
    if (!changeRequest) {
      return Response.json({ error: 'Change request not found' }, { status: 404 });
    }

    // Fetch current movement
    const movement = await base44.entities.Movement.read(changeRequest.movement_id);
    if (!movement) {
      return Response.json({ error: 'Movement not found' }, { status: 404 });
    }

    if (action === 'aprovada') {
      // Get current version count
      const versions = await base44.entities.MovementVersion.filter({ movement_id: movement.id });
      const nextVersion = versions.length + 1;

      // Create snapshot of current version BEFORE changes
      await base44.asServiceRole.entities.MovementVersion.create({
        movement_id: movement.id,
        version_number: nextVersion,
        movement_data: JSON.stringify(movement),
        change_request_id: request_id,
        changed_by: user.email,
        changed_at: new Date().toISOString().split('T')[0],
        change_summary: changeRequest.reason,
        reviewer_notes: reviewer_notes || ''
      });

      // Apply proposed changes
      const proposedChanges = JSON.parse(changeRequest.proposed_changes);
      const updatedMovement = { ...movement, ...proposedChanges };
      await base44.asServiceRole.entities.Movement.update(movement.id, updatedMovement);

      // Log activity
      await base44.asServiceRole.entities.ActivityLog.create({
        user_email: user.email,
        user_name: user.full_name || user.email,
        action: 'Alteração aprovada',
        module: 'Movements',
        entity_id: movement.id,
        details: `Versão ${nextVersion} criada. Motivo: ${changeRequest.reason}`
      });
    }

    // Update change request status
    await base44.asServiceRole.entities.MovementChangeRequest.update(request_id, {
      status: action,
      reviewer_email: user.email,
      reviewer_name: user.full_name || user.email,
      reviewed_at: new Date().toISOString().split('T')[0]
    });

    return Response.json({ ok: true, version_number: action === 'aprovada' ? versions.length + 1 : null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});