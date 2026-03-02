import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, request_id, requester_name, requester_email, movement_summary, reason, reviewer_name, reviewer_notes } = body;

    // Get all supervisors and admins to notify
    const allUsers = await base44.asServiceRole.entities.User.list();
    const reviewers = allUsers.filter(u => u.role === "supervisor" || u.role === "admin");

    const isNewRequest = !action; // no action = new request notification

    if (isNewRequest) {
      // Notify all supervisors/admins: internal notification + email
      for (const reviewer of reviewers) {
        // Internal notification
        await base44.asServiceRole.entities.Notification.create({
          user_email: reviewer.email,
          title: "Nova solicitação de alteração",
          message: `${requester_name} solicitou alteração: ${movement_summary}. Motivo: ${reason}`,
          type: "change_request",
          reference_id: request_id,
          read: false,
        });

        // Email
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: reviewer.email,
          subject: `ReforestStock • Solicitação de alteração #${request_id?.slice(-6)}`,
          body: `
<p>Olá, ${reviewer.full_name || reviewer.email},</p>
<p>Uma nova solicitação de alteração foi criada no ReforestStock.</p>
<ul>
  <li><strong>Solicitante:</strong> ${requester_name}</li>
  <li><strong>Movimentação:</strong> ${movement_summary}</li>
  <li><strong>Motivo:</strong> ${reason}</li>
</ul>
<p>Acesse o sistema para revisar e aprovar ou rejeitar esta solicitação.</p>
<p>—<br/>ReforestStock</p>
          `.trim(),
        });
      }
    } else {
      // Notify the original requester of the decision
      if (requester_email) {
        const statusLabel = action === "aprovada" ? "aprovada ✅" : "rejeitada ❌";

        await base44.asServiceRole.entities.Notification.create({
          user_email: requester_email,
          title: `Solicitação ${statusLabel}`,
          message: `Sua solicitação para "${movement_summary}" foi ${statusLabel} por ${reviewer_name}.${reviewer_notes ? ` Observações: ${reviewer_notes}` : ""}`,
          type: action === "aprovada" ? "approval" : "rejection",
          reference_id: request_id,
          read: false,
        });

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: requester_email,
          subject: `ReforestStock • Solicitação #${request_id?.slice(-6)} ${statusLabel}`,
          body: `
<p>Olá, ${requester_name},</p>
<p>Sua solicitação de alteração foi <strong>${statusLabel}</strong> por <strong>${reviewer_name}</strong>.</p>
<ul>
  <li><strong>Movimentação:</strong> ${movement_summary}</li>
  ${reviewer_notes ? `<li><strong>Observações:</strong> ${reviewer_notes}</li>` : ""}
</ul>
<p>—<br/>ReforestStock</p>
          `.trim(),
        });
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});