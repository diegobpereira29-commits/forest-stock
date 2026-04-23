import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const WRITE_ROLES = ['admin', 'almoxarife'];

// Movement types that reduce stock
const STOCK_OUT_TYPES = ['saida', 'perda'];
// Movement types that increase stock
const STOCK_IN_TYPES = ['entrada'];
// Movement types that set stock to exact value
const STOCK_SET_TYPES = ['ajuste'];
// Movement types that do not affect stock
const STOCK_NEUTRAL_TYPES = ['transferencia'];

function calcNewStock(currentStock, type, quantity) {
  const current = Number(currentStock || 0);
  const qty = Number(quantity);
  if (STOCK_IN_TYPES.includes(type)) return current + qty;
  if (STOCK_OUT_TYPES.includes(type)) return current - qty;
  if (STOCK_SET_TYPES.includes(type)) return qty;
  return current; // transferencia — no net change
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user = null;
  let prod = null;
  let createdMovementId = null;

  try {
    // 1. Authentication
    user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Role check
    if (!WRITE_ROLES.includes(user.role)) {
      return Response.json({ error: 'Forbidden: only admin or almoxarife can save movements' }, { status: 403 });
    }

    const body = await req.json();
    const { data, movement_id } = body;

    // 3. Admin-only for updates
    if (movement_id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: only admin can edit existing movements' }, { status: 403 });
    }

    // 4. Required field validation
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
    const productList = await base44.asServiceRole.entities.Product.filter({ id: data.product_id }, '-created_date', 1);
    if (!productList || productList.length === 0) {
      return Response.json({ error: `Produto não encontrado: ${data.product_id}` }, { status: 422 });
    }
    prod = productList[0];

    // 6. Referential integrity — project_id
    if (data.project_id) {
      const project = await base44.asServiceRole.entities.Project.filter({ id: data.project_id }, '-created_date', 1);
      if (!project || project.length === 0) {
        return Response.json({ error: `Projeto não encontrado: ${data.project_id}` }, { status: 422 });
      }
    }

    // 7. Referential integrity — team_id
    if (data.team_id) {
      const team = await base44.asServiceRole.entities.Team.filter({ id: data.team_id }, '-created_date', 1);
      if (!team || team.length === 0) {
        return Response.json({ error: `Equipe não encontrada: ${data.team_id}` }, { status: 422 });
      }
    }

    // ── CREATE PATH (transactional) ──────────────────────────────────────────
    if (!movement_id) {
      // 8a. Pre-flight: check for negative stock BEFORE writing anything
      if (!STOCK_NEUTRAL_TYPES.includes(data.type) && !STOCK_SET_TYPES.includes(data.type)) {
        const projected = calcNewStock(prod.current_stock, data.type, data.quantity);
        if (projected < 0) {
          await base44.asServiceRole.entities.ActivityLog.create({
            user_email: user.email,
            user_name: user.full_name || user.email,
            action: 'Falha ao criar movimentação — estoque insuficiente',
            module: 'Movimentações',
            details: `Tipo: ${data.type} | Produto: ${prod.name} | Estoque atual: ${prod.current_stock} | Qtd. solicitada: ${data.quantity} | Resultado projetado: ${projected}`,
          });
          return Response.json({
            error: `Estoque insuficiente para "${prod.name}". Saldo atual: ${prod.current_stock} ${prod.unit}. Quantidade solicitada: ${data.quantity}.`,
          }, { status: 422 });
        }
      }

      // 8b. Step 1 — create the Movement record
      const movement = await base44.asServiceRole.entities.Movement.create(data);
      createdMovementId = movement.id;

      // 8c. Step 2 — update product stock
      const newStock = calcNewStock(prod.current_stock, data.type, data.quantity);
      try {
        await base44.asServiceRole.entities.Product.update(prod.id, {
          current_stock: Math.max(0, newStock),
        });
      } catch (stockError) {
        // ROLLBACK: delete the movement we just created
        await base44.asServiceRole.entities.Movement.delete(createdMovementId).catch(() => {});

        await base44.asServiceRole.entities.ActivityLog.create({
          user_email: user.email,
          user_name: user.full_name || user.email,
          action: 'Falha ao atualizar estoque — movimentação revertida (rollback)',
          module: 'Movimentações',
          details: `Produto: ${prod.name} | Movimentação ${createdMovementId} deletada | Erro: ${stockError.message}`,
        });

        return Response.json({
          error: 'Falha ao atualizar o estoque. A movimentação foi revertida automaticamente.',
        }, { status: 500 });
      }

      // 8d. Success log
      await base44.asServiceRole.entities.ActivityLog.create({
        user_email: user.email,
        user_name: user.full_name || user.email,
        action: 'Criou movimentação',
        module: 'Movimentações',
        entity_id: movement.id,
        details: `Tipo: ${data.type} | Produto: ${prod.name} | Qtd: ${data.quantity} | Estoque anterior: ${prod.current_stock} | Novo estoque: ${Math.max(0, newStock)}`,
      });

      return Response.json({ success: true, movement });
    }

    // ── UPDATE PATH (admin direct edit — no stock recalculation) ─────────────
    const updated = await base44.asServiceRole.entities.Movement.update(movement_id, data);

    await base44.asServiceRole.entities.ActivityLog.create({
      user_email: user.email,
      user_name: user.full_name || user.email,
      action: 'Editou movimentação',
      module: 'Movimentações',
      entity_id: movement_id,
      details: `Produto: ${prod.name} | Qtd: ${data.quantity}`,
    });

    return Response.json({ success: true, movement: updated });

  } catch (error) {
    // Top-level failure log
    if (user) {
      await base44.asServiceRole.entities.ActivityLog.create({
        user_email: user.email,
        user_name: user.full_name || user.email,
        action: 'Erro inesperado ao salvar movimentação',
        module: 'Movimentações',
        details: `Erro: ${error.message}`,
      }).catch(() => {});
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});