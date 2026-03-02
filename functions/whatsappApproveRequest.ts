import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Approve or reject a MovementChangeRequest via WhatsApp
 * Requires: whatsapp_number, employee_id, request_id, action (approve/reject), notes
 * Authenticates user via WhatsApp + employee_id confirmation
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const {
            whatsapp_number,
            employee_id,
            request_id,
            action,
            notes = ''
        } = await req.json();

        if (!whatsapp_number || !employee_id || !request_id || !action) {
            return Response.json({
                error: 'Missing required fields: whatsapp_number, employee_id, request_id, action'
            }, { status: 400 });
        }

        // Authenticate user via WhatsApp with employee_id confirmation
        const authRes = await fetch(new URL(`${Deno.env.get('BASE44_API_URL')}/functions/whatsappAuth`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                whatsapp_number,
                require_employee_confirmation: true,
                employee_id_attempt: employee_id
            })
        });

        const authData = await authRes.json();
        if (!authData.success) {
            return Response.json({ error: authData.message }, { status: 403 });
        }

        const user = authData.user;

        // Check if user has permission to approve
        if (!authData.permissions.can_approve) {
            return Response.json({
                error: 'Usuário não tem permissão para aprovar solicitações'
            }, { status: 403 });
        }

        // Fetch the request
        const changeRequest = await base44.asServiceRole.entities.MovementChangeRequest.get(request_id);
        if (!changeRequest) {
            return Response.json({ error: 'Solicitação não encontrada' }, { status: 404 });
        }

        // Validate action
        const statusMap = { 'approve': 'aprovada', 'reject': 'rejeitada' };
        const newStatus = statusMap[action];
        if (!newStatus) {
            return Response.json({ error: 'action deve ser approve ou reject' }, { status: 400 });
        }

        // Update the request
        const updated = await base44.asServiceRole.entities.MovementChangeRequest.update(request_id, {
            status: newStatus,
            reviewer_email: user.email,
            reviewer_name: user.full_name,
            reviewer_notes: notes || '',
            reviewed_at: new Date().toISOString().split('T')[0]
        });

        // If approved, call approveMovementChange
        if (action === 'approve') {
            const approveRes = await base44.functions.invoke('approveMovementChange', {
                request_id,
                action: 'aprovada',
                reviewer_notes: notes
            });
            if (approveRes.data?.error) {
                throw new Error(approveRes.data.error);
            }
        }

        // Log the action
        await base44.asServiceRole.entities.WhatsAppLog.create({
            user_id: user.id,
            user_email: user.email,
            employee_id: user.employee_id,
            whatsapp_number: whatsapp_number.replace(/\D/g, ''),
            action: `${action}_movement_change_request`,
            action_type: 'critical',
            message: `${action === 'approve' ? 'Aprovação' : 'Rejeição'} via WhatsApp`,
            request_id,
            status: 'completed',
            result: `Solicitação ${newStatus}`,
            timestamp: new Date().toISOString()
        }).catch(() => {});

        return Response.json({
            success: true,
            message: `Solicitação ${newStatus} com sucesso via WhatsApp`,
            request: {
                id: updated.id,
                status: updated.status,
                reviewed_at: updated.reviewed_at
            }
        }, { status: 200 });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});