import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
dotenv.config();

const databaseUrl = process.env.DB_URL;
export const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : {}
    })
  : new Sequelize({ dialect: 'sqlite', storage: './petshop.sqlite', logging: false });

export const config = {
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN
    || process.env.RENDER_EXTERNAL_URL
    || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : 'http://localhost:5173'),
  adminPassword: process.env.ADMIN_PASSWORD,
  nodeEnv: process.env.NODE_ENV || 'development',
  trustProxy: process.env.TRUST_PROXY
    ? Number(process.env.TRUST_PROXY)
    : process.env.NODE_ENV === 'production' ? 1 : false
};
