import { Router } from 'express';
import { sequelize } from '../config.js';
import { Product, Sale, SaleItem, StockMovement } from '../models/index.js';
import { requireAdmin } from '../auth.js';
const router = Router();
router.use(requireAdmin);

router.get('/', async (req,res,next) => {
  try {
    const sales = await Sale.findAll({ include:[{model:SaleItem}], order:[['createdAt','DESC']], limit:200 });
    res.json(sales);
  } catch(e) { next(e); }
});

router.post('/', async (req,res,next) => {
  const t = await sequelize.transaction();
  try {
    const customer = String(req.body.customer || 'Cliente general').trim().slice(0,160);
    const notes = String(req.body.notes || '').slice(0,2000);
    const items = req.body.items;
    if (!Array.isArray(items) || items.length === 0) { await t.rollback(); return res.status(400).json({error:'Agrega al menos un producto.'}); }
    let total = 0; const prepared = [];
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) { await t.rollback(); return res.status(400).json({error:'Las cantidades deben ser enteros mayores que cero.'}); }
      const product = await Product.findByPk(item.productId, { transaction:t, lock:t.LOCK.UPDATE });
      if (!product || !product.active) { await t.rollback(); return res.status(400).json({error:'Uno de los productos ya no está disponible.'}); }
      if (product.stock < quantity) { await t.rollback(); return res.status(409).json({error:`Stock insuficiente para ${product.brand} ${product.name}. Disponible: ${product.stock}.`}); }
      const unitPrice = Number(product.price); const subtotal = unitPrice * quantity;
      total += subtotal; prepared.push({product, quantity, unitPrice, subtotal});
    }
    const sale = await Sale.create({ customer:customer || 'Cliente general', total, notes }, {transaction:t});
    for (const line of prepared) {
      const previousStock = line.product.stock;
      await line.product.update({stock:previousStock-line.quantity},{transaction:t});
      await SaleItem.create({SaleId:sale.id, ProductId:line.product.id, productName:`${line.product.brand} ${line.product.name}`, quantity:line.quantity, unitPrice:line.unitPrice, subtotal:line.subtotal},{transaction:t});
      await StockMovement.create({ProductId:line.product.id, SaleId:sale.id, type:'OUT', quantity:line.quantity, previousStock, newStock:previousStock-line.quantity, reason:`Venta #${sale.id}`},{transaction:t});
    }
    await t.commit();
    const result = await Sale.findByPk(sale.id,{include:[SaleItem]});
    res.status(201).json(result);
  } catch(e) { await t.rollback(); next(e); }
});
export default router;
