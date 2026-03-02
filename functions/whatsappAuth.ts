import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Authenticate user via WhatsApp number
 * Returns user data, role, employee_id and permissions if found and active
 * Logs the attempt automatically
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { whatsapp_number, require_employee_confirmation = false, employee_id_attempt = null } = await req.json();

        if (!whatsapp_number) {
            return Response.json({ error: 'whatsapp_number is required' }, { status: 400 });
        }

        // Normalize WhatsApp number (remove any non-digits)
        const normalizedNumber = whatsapp_number.replace(/\D/g, '');

        // Search for user by WhatsApp number and is_active = true
        const users = await base44.asServiceRole.entities.User.filter({
            whatsapp_number: normalizedNumber,
            is_active: true
        });

        if (!users || users.length === 0) {
            // Log failed authentication attempt
            await base44.asServiceRole.entities.WhatsAppLog.create({
                action: 'authentication_failed',
                action_type: 'info',
                whatsapp_number: normalizedNumber,
                status: 'failed',
                result: 'Número não autorizado no sistema',
                timestamp: new Date().toISOString()
            }).catch(() => {});

            return Response.json({
                success: false,
                message: 'Número de WhatsApp não autorizado no sistema',
                code: 'UNAUTHORIZED'
            }, { status: 401 });
        }

        const user = users[0];

        // If critical action requested, require employee_id confirmation
        if (require_employee_confirmation) {
            if (!employee_id_attempt) {
                return Response.json({
                    success: false,
                    message: 'Esta ação requer confirmação de matrícula (employee_id)',
                    requires_confirmation: true,
                    code: 'CONFIRMATION_REQUIRED'
                }, { status: 403 });
            }

            // Verify employee_id matches
            if (employee_id_attempt !== user.employee_id) {
                await base44.asServiceRole.entities.WhatsAppLog.create({
                    action: 'employee_id_mismatch',
                    action_type: 'critical',
                    user_id: user.id,
                    user_email: user.email,
                    employee_id: user.employee_id,
                    whatsapp_number: normalizedNumber,
                    status: 'failed',
                    result: `Matrícula informada (${employee_id_attempt}) não corresponde ao registro`,
                    timestamp: new Date().toISOString()
                }).catch(() => {});

                return Response.json({
                    success: false,
                    message: 'Matrícula não corresponde',
                    code: 'INVALID_EMPLOYEE_ID'
                }, { status: 403 });
            }
        }

        // Log successful authentication
        await base44.asServiceRole.entities.WhatsAppLog.create({
            action: 'authentication_success',
            action_type: 'info',
            user_id: user.id,
            user_email: user.email,
            employee_id: user.employee_id,
            whatsapp_number: normalizedNumber,
            status: 'completed',
            result: `Autenticado como ${user.full_name} (${user.role})`,
            timestamp: new Date().toISOString()
        }).catch(() => {});

        // Return user data with permissions
        return Response.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                employee_id: user.employee_id,
                role: user.role,
                whatsapp_verified: user.whatsapp_verified
            },
            permissions: {
                can_approve: ['admin', 'supervisor'].includes(user.role),
                can_create_movement: ['admin', 'almoxarife'].includes(user.role),
                can_generate_report: ['admin', 'supervisor'].includes(user.role),
                can_view_all: user.role === 'admin',
                role: user.role
            }
        }, { status: 200 });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});