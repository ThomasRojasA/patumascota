import { DataTypes } from 'sequelize';
import { sequelize } from '../config.js';
export { sequelize };

export const Product = sequelize.define('Product', {
  brand: { type: DataTypes.STRING(100), allowNull: false },
  name: { type: DataTypes.STRING(160), allowNull: false },
  price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0 } },
  stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
  image: { type: DataTypes.TEXT, allowNull: true, defaultValue: '' },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
});

export const Sale = sequelize.define('Sale', {
  customer: { type: DataTypes.STRING(160), allowNull: false, defaultValue: 'Cliente general' },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true, defaultValue: '' }
});

export const SaleItem = sequelize.define('SaleItem', {
  productName: { type: DataTypes.STRING(260), allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false }
});

export const StockMovement = sequelize.define('StockMovement', {
  type: { type: DataTypes.ENUM('IN', 'OUT', 'ADJUSTMENT'), allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  previousStock: { type: DataTypes.INTEGER, allowNull: false },
  newStock: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.STRING(250), allowNull: false, defaultValue: '' }
});

Product.hasMany(StockMovement, { foreignKey: { allowNull: false }, onDelete: 'RESTRICT' });
StockMovement.belongsTo(Product);
Sale.hasMany(SaleItem, { foreignKey: { allowNull: false }, onDelete: 'CASCADE' });
SaleItem.belongsTo(Sale);
SaleItem.belongsTo(Product, { foreignKey: { allowNull: true }, constraints: false });
StockMovement.belongsTo(Sale, { foreignKey: { allowNull: true }, constraints: false });
