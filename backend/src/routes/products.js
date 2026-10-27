import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Op } from 'sequelize';
import { Product, StockMovement, sequelize } from '../models/index.js';
import { requireAdmin } from '../auth.js';

const router = Router();
const asProduct = (p) => p.toJSON();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new Error('Formato no válido. Usa una imagen JPG, PNG o WebP.'));
      return;
    }
    callback(null, true);
  }
});

router.get('/', (req, res, next) => {
  if (req.query.includeInactive === 'true') return requireAdmin(req, res, next);
  next();
}, async (req, res, next) => {
  try {
    const where = {};
    if (req.query.includeInactive !== 'true') where.active = true;
    if (req.query.q) where[Op.or] = [
      { name: { [Op.like]: `%${req.query.q}%` } },
      { brand: { [Op.like]: `%${req.query.q}%` } }
    ];
    if (req.query.brand) where.brand = req.query.brand;
    res.json((await Product.findAll({ where, order: [['brand','ASC'],['name','ASC']] })).map(asProduct));
  } catch (e) { next(e); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { brand, name, price, stock = 0, image = '' } = req.body;
    if (!String(brand || '').trim() || !String(name || '').trim() || !Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(stock)) || Number(stock) < 0) {
      await t.rollback(); return res.status(400).json({ error: 'Marca, nombre, precio y stock son obligatorios y deben ser válidos.' });
    }
    const product = await Product.create({ brand: brand.trim(), name: name.trim(), price: Number(price), stock: Number(stock), image }, { transaction: t });
    if (Number(stock) > 0) await StockMovement.create({ ProductId: product.id, type:'IN', quantity:Number(stock), previousStock:0, newStock:Number(stock), reason:'Stock inicial' }, { transaction:t });
    await t.commit(); res.status(201).json(asProduct(product));
  } catch (e) { await t.rollback(); next(e); }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const product = await Product.findByPk(req.params.id, { transaction:t, lock:t.LOCK.UPDATE });
    if (!product) { await t.rollback(); return res.status(404).json({ error:'Producto no encontrado.' }); }
    const { brand, name, price, stock, image, active } = req.body;
    if (price !== undefined && (!Number.isFinite(Number(price)) || Number(price) < 0)) { await t.rollback(); return res.status(400).json({error:'Precio inválido.'}); }
    if (stock !== undefined && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) { await t.rollback(); return res.status(400).json({error:'El stock debe ser un entero igual o mayor que cero.'}); }
    const previous = product.stock;
    await product.update({
      ...(brand !== undefined ? {brand:String(brand).trim()} : {}),
      ...(name !== undefined ? {name:String(name).trim()} : {}),
      ...(price !== undefined ? {price:Number(price)} : {}),
      ...(stock !== undefined ? {stock:Number(stock)} : {}),
      ...(image !== undefined ? {image} : {}),
      ...(active !== undefined ? {active:Boolean(active)} : {})
    }, { transaction:t });
    if (stock !== undefined && Number(stock) !== previous) {
      await StockMovement.create({ ProductId:product.id, type:'ADJUSTMENT', quantity:Math.abs(Number(stock)-previous), previousStock:previous, newStock:Number(stock), reason:'Ajuste manual de inventario' }, {transaction:t});
    }
    await t.commit(); res.json(asProduct(product));
  } catch(e) { await t.rollback(); next(e); }
});

router.post('/:id/image', requireAdmin, (req, res, next) => {
  imageUpload.single('image')(req, res, error => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'La imagen supera el máximo permitido de 5 MB.' });
    }
    return res.status(400).json({ error: error.message || 'No se pudo procesar la imagen.' });
  });
}, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen JPG, PNG o WebP.' });
    const product = await Product.findByPk(req.params.id);
    if (!product || !product.active) return res.status(404).json({ error: 'Producto no encontrado.' });

    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      return res.status(503).json({ error: 'Configura CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en Render → Environment.' });
    }

    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME.trim(),
      api_key: CLOUDINARY_API_KEY.trim(),
      api_secret: CLOUDINARY_API_SECRET.trim()
    });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        folder: 'pa-tu-mascota/productos',
        public_id: `producto-${product.id}`,
        overwrite: true,
        resource_type: 'image'
      }, (error, uploaded) => {
        if (error) reject(error);
        else resolve(uploaded);
      });
      stream.end(req.file.buffer);
    });

    await product.update({ image: result.secure_url });
    res.json(asProduct(product));
  } catch (error) {
    if (error.http_code === 401 && /Invalid Signature/i.test(error.message || '')) {
      console.error('Cloudinary rechazó la firma de carga. Revisa las credenciales de Cloudinary configuradas.');
      return res.status(502).json({
        error: 'Cloudinary rechazó la firma. Verifica que CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET sean de la misma cuenta y copia el API Secret actual desde Cloudinary. Luego reinicia el backend.'
      });
    }
    next(error);
  }
});

router.delete('/:id', requireAdmin, async (req,res,next) => {
  try {
    const p = await Product.findByPk(req.params.id);
    if (!p) return res.status(404).json({error:'Producto no encontrado.'});
    await p.update({active:false});
    res.json({message:'Producto archivado.'});
  } catch(e) { next(e); }
});
export default router;
