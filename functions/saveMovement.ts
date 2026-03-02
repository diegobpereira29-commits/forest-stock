import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const WRITE_ROLES = ['admin', 'almoxarife'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Role check
    if (!WRITE_ROLES.includes(user.role)) {
      return Response.json({ error: 'Forbidden: only admin or almoxarife can save movements' }, { status: 403 });
    }

    const body = await req.json();
    const { data, movement_id } = body; // movement_id present = update (admin only)

    // 3. Admin-only for updates
    if (movement_id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: only admin can edit existing movements' }, { status: 403 });
    }

    // 4. Required field check
    if (!data.product_id) {
      return Response.json({ error: 'product_id é obrigatório' }, { status: 400 });
    }
    if (!data.type) {
      return Response.json({ error: 'type é obrigatório' }, { status: 400 });
    }
    if (!data.quantity || Number(data.quantity) <= 0) {
      return Response.json({ error: 'quantity deve ser maior que zero' }, { status: 400 });
    }

    // 5. Referential integrity — product_id
    const product = await base44.asServiceRole.entities.Product.filter({ id: data.product_id }, '-created_date', 1);
    if (!product || product.length === 0) {
      return Response.json({ error: `Produto não encontrado: ${data.product_id}` }, { status: 422 });
    }
    const prod = product[0];

    // 6. Referential integrity — project_id (when provided)
    if (data.project_id) {
      const project = await base44.asServiceRole.entities.Project.filter({ id: data.project_id }, '-created_date', 1);
      if (!project || project.length === 0) {
        return Response.json({ error: `Projeto não encontrado: ${data.project_id}` }, { status: 422 });
      }
    }

    // 7. Referential integrity — team_id (when provided)
    if (data.team_id) {
      const team = await base44.asServiceRole.entities.Team.filter({ id: data.team_id }, '-created_date', 1);
      if (!team || team.length === 0) {
        return Response.json({ error: `Equipe não encontrada: ${data.team_id}` }, { status: 422 });
      }
    }

    // 8. Save movement
    let result;
    if (movement_id) {
      // Update existing (no stock recalculation — admin direct edit)
      result = await base44.asServiceRole.entities.Movement.update(movement_id, data);
    } else {
      // Create new movement and update product stock atomically
      result = await base44.asServiceRole.entities.Movement.create(data);

      let newStock = Number(prod.current_stock || 0);
      if (data.type === 'entrada') newStock += Number(data.quantity);
      else if (data.type === 'saida' || data.type === 'perda') newStock -= Number(data.quantity);
      else if (data.type === 'ajuste') newStock = Number(data.quantity);
      // transferencia does not affect global stock count

      await base44.asServiceRole.entities.Product.update(prod.id, {
        current_stock: Math.max(0, newStock),
      });
    }

    // 9. Activity log
    await base44.asServiceRole.entities.ActivityLog.create({
      user_email: user.email,
      user_name: user.full_name || user.email,
      action: movement_id ? 'Editou movimentação' : 'Criou movimentação',
      module: 'Movimentações',
      entity_id: result?.id || movement_id,
      details: `Tipo: ${data.type} | Produto: ${prod.name} | Qtd: ${data.quantity}`,
    });

    return Response.json({ success: true, movement: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});