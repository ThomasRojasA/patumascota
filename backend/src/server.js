import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sequelize } from './config.js';
import { Product } from './models/index.js';
import { initialProducts } from './seed.js';
import { config } from './config.js';
import productsRouter from './routes/products.js';
import salesRouter from './routes/sales.js';
import movementsRouter from './routes/movements.js';
import authRouter from './routes/auth.js';
import { requireAdmin } from './auth.js';

const app = express();
const backendDirectory = dirname(fileURLToPath(import.meta.url));
const frontendBuildDirectory = resolve(backendDirectory, '../../frontend/dist');
app.set('trust proxy', config.trustProxy);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com']
    }
  }
}));
app.use(cors({
  origin: config.frontendOrigin.split(',').map(x=>x.trim()),
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({limit:'8mb'}));
app.get('/api/health', (_req,res)=>res.json({status:'ok',service:'PetShop Pro API'}));
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/sales', salesRouter);
app.use('/api/movements', movementsRouter);
if (config.nodeEnv === 'production') {
  if (!existsSync(resolve(frontendBuildDirectory, 'index.html'))) {
    throw new Error('No se encontró frontend/dist/index.html. Ejecuta npm run build antes de iniciar en producción.');
  }
  app.use(express.static(frontendBuildDirectory, { index: false, maxAge: '1d' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(resolve(frontendBuildDirectory, 'index.html'));
  });
}
app.get('/api/dashboard', requireAdmin, async (_req,res,next)=>{
  try {
    const products = await Product.findAll({where:{active:true}});
    const [salesCount, salesRows] = await Promise.all([
      (await import('./models/index.js')).Sale.count(),
      (await import('./models/index.js')).Sale.findAll({attributes:['total']})
    ]);
    res.json({
      products:products.length,
      stockUnits:products.reduce((s,p)=>s+p.stock,0),
      lowStock:products.filter(p=>p.stock<=5).length,
      salesCount,
      salesTotal:salesRows.reduce((s,x)=>s+Number(x.total),0)
    });
  } catch(e) { next(e); }
});
app.use((err,_req,res,_next)=>{
  console.error(err);
  res.status(500).json({error:'Ocurrió un error en el servidor.'});
});

async function start(){
  try {
    if (config.nodeEnv === 'production') {
      if (!config.adminPassword || config.adminPassword.length < 16) {
        throw new Error('En producción, ADMIN_PASSWORD debe tener al menos 16 caracteres.');
      }
      const allowedOrigins = config.frontendOrigin.split(',').map(origin => origin.trim());
      if (allowedOrigins.some(origin => {
        try {
          const parsed = new URL(origin);
          return parsed.protocol !== 'https:' || parsed.origin !== origin;
        } catch {
          return true;
        }
      })) {
        throw new Error('En producción, FRONTEND_ORIGIN debe contener solo orígenes HTTPS exactos, sin rutas ni comodines.');
      }
      if (!process.env.DB_URL) {
        throw new Error('En producción debes configurar DB_URL con PostgreSQL; SQLite no se considera almacenamiento persistente para el hosting.');
      }
      if (!Number.isInteger(config.trustProxy) || config.trustProxy < 1) {
        throw new Error('Configura TRUST_PROXY como el número de proxies confiables de tu hosting (normalmente 1).');
      }
    }
    await sequelize.authenticate();
    await sequelize.sync();
    if (await Product.count() === 0) await Product.bulkCreate(initialProducts);
    app.listen(config.port,()=>console.log(`PetShop API lista en http://localhost:${config.port}`));
  } catch(e) { console.error('No se pudo iniciar la API:',e); process.exit(1); }
}
start();
