import { Router } from 'express';
import { Op } from 'sequelize';
import { Product, StockMovement } from '../models/index.js';
import { requireAdmin } from '../auth.js';
const router = Router();
router.use(requireAdmin);
router.get('/', async (req,res,next) => {
  try {
    const movements = await StockMovement.findAll({include:[{model:Product,attributes:['id','brand','name']}],order:[['createdAt','DESC']],limit:300});
    res.json(movements);
  } catch(e) { next(e); }
});
router.post('/', async (req,res,next) => {
  try {
    const product = await Product.findByPk(req.body.productId);
    const quantity = Number(req.body.quantity);
    const type = req.body.type;
    if (!product || !product.active) return res.status(404).json({error:'Producto no encontrado.'});
    if (!Number.isInteger(quantity) || quantity < 1 || !['IN','OUT'].includes(type)) return res.status(400).json({error:'Tipo o cantidad inválidos.'});
    if (type === 'OUT' && product.stock < quantity) return res.status(409).json({error:'No hay stock suficiente.'});
    const previousStock = product.stock;
    const newStock = type === 'IN' ? previousStock + quantity : previousStock - quantity;
    await product.update({stock:newStock});
    const movement = await StockMovement.create({ProductId:product.id,type,quantity,previousStock,newStock,reason:String(req.body.reason || (type==='IN'?'Reposición':'Salida manual')).slice(0,250)});
    res.status(201).json(movement);
  } catch(e) { next(e); }
});
export default router;
