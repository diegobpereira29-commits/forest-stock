import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Log WhatsApp action with full audit trail
 * Required: user_id, employee_id, whatsapp_number, action, action_type
 * Optional: request_id, message, result, status
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const {
            user_id,
            user_email,
            employee_id,
            whatsapp_number,
            action,
            action_type = 'action', // 'info', 'action', 'critical'
            message = '',
            request_id = '',
            status = 'completed',
            result = ''
        } = await req.json();

        // Validate required fields
        if (!user_id || !employee_id || !whatsapp_number || !action) {
            return Response.json({
                error: 'Missing required fields: user_id, employee_id, whatsapp_number, action'
            }, { status: 400 });
        }

        // Validate action_type
        if (!['info', 'action', 'critical'].includes(action_type)) {
            return Response.json({
                error: 'action_type must be: info, action, or critical'
            }, { status: 400 });
        }

        // Create log entry
        const logEntry = await base44.asServiceRole.entities.WhatsAppLog.create({
            user_id,
            user_email: user_email || '',
            employee_id,
            whatsapp_number: whatsapp_number.replace(/\D/g, ''),
            action,
            action_type,
            message,
            request_id: request_id || null,
            status,
            result,
            timestamp: new Date().toISOString()
        });

        // For critical actions, also log to ActivityLog
        if (action_type === 'critical') {
            await base44.asServiceRole.entities.ActivityLog.create({
                user_email: user_email || 'whatsapp',
                user_name: user_email || 'WhatsApp User',
                action: `${action} (via WhatsApp)`,
                module: 'WhatsApp',
                entity_id: request_id || user_id,
                details: JSON.stringify({
                    employee_id,
                    whatsapp_number: whatsapp_number.replace(/\D/g, ''),
                    result,
                    message
                })
            }).catch(() => {});
        }

        return Response.json({
            success: true,
            log_id: logEntry.id,
            timestamp: logEntry.created_date
        }, { status: 201 });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});