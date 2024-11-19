// 創建專屬租戶 Schema
const getTenantDatabase = require('../models/tenant'); // 動態選擇租戶資料庫
async function createTenantDatabase(databaseName) {
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: dbConfig.host,
    username: dbConfig.username,
    password: dbConfig.password,
  });
  // 創建新資料庫
  await sequelize.query(CREATE DATABASE IF NOT EXISTS ${databaseName};);
  // 關閉連接
  await sequelize.close();
}

// 動態選擇租戶 Schema
const vehicleController = {    
  const getTenantDatabase = require('../models/tenant'); // 動態選擇租戶資料庫
    getAllEvents: async (req, res) => {
        try {
            const tenantId = req.tenant.id;
            const tenantDb = getTenantDatabase(tenant_${tenantId});
    
            // 查詢 VehicleBorrowing 和 Vehicle
            const events = await tenantDb.VehicleBorrowing.findAll({
                where: {
                    status: { [Op.is]: null }
                },
                include: [
                    {
                        model: tenantDb.Vehicle,
                        as: 'vehicle'
                    }
                ],
            });
        }
      }
  }
