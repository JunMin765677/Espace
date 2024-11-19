// utils/sessionStore.js
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const dotenv = require('dotenv');
dotenv.config();  // 加載環境變數

const options = {
    host: process.env.DATABASE_HOST,
    // port: process.env.DB_PORT,
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.MAIN_DATABASE,
    // 可選的其他參數
    clearExpired: true,               // 自動清除過期 session
    checkExpirationInterval: 900000,  // 每 15 分鐘檢查過期 session
    expiration: 10 * 60 * 60 * 1000,  // 設定 session 的有效期為 10 小時
};

const sessionStore = new MySQLStore(options);
module.exports = sessionStore;




// controllers/auth.js
const sessionStore = require('../utils/sessionStore');
const userController = {
  login: async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // 1. 查詢 User 表中所有關聯該 email 的記錄
      const users = await User.findAll({
          where: { email },
          include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name'] }]
      });

      // 2. 確認 email 是否存在
      if (users.length === 0) {
          return res.status(400).json({ success: false, field: 'email', message: '找不到您的帳戶' });
      }

      // 3. 若只找到一個 User 記錄
      if (users.length === 1) {
          const singleUser = users[0];
          const isPasswordValid = bcrypt.compareSync(password, singleUser.password);

          if (!isPasswordValid) {
              return res.status(400).json({ success: false, field: 'password', message: '密碼不正確' });
          }

          // 生成更安全的 session ID
          const sessionID = `sess_${singleUser.id}_${crypto.randomBytes(16).toString('hex')}`;

          // 將用戶和租戶信息存儲到 sessionStore 中
          await sessionStore.set(sessionID, {
              userID: singleUser.id,
              tenantID: singleUser.tenant.id,
              tenantName: singleUser.tenant.name,
              email: singleUser.email,
              role: singleUser.role
          });
          
          res.cookie('sessionID', sessionID, {
              httpOnly: true,   // 防止 JavaScript 訪問
              secure: process.env.NODE_ENV === 'production', // 僅在 HTTPS 上傳遞
              secure: false,
              maxAge: 10 * 60 * 60 * 1000  // 設置 10 小時過期時間
          });
          // console.log('Cookie set with sessionID:', sessionID);

          // console.log('Login response being sent with redirectUrl to /vehicle');
          return res.status(200).json({ success: true, message: '登入成功', redirectUrl: '/vehicle/dashboard' });
      }

      // 4. 若有多個記錄，讓用戶選擇具體租戶
      const tenantOptions = users.map(user => ({
          tenantId: user.tenantId,
          tenantName: user.tenant ? user.tenant.name : '未知的租戶'
      }));

      return res.status(200).json({ 
          success: true, 
          multipleTenants: true,
          tenants: tenantOptions,
          message: '請選擇要登入的單位帳號'
      });

    } catch (error) {
        console.error(`Error during login: ${error}`);
        return res.status(500).json({ success: false, message: '伺服器發生錯誤，請稍後重試。' });
    }
  },
}



// middleware/sessionCheck.js
const sessionStore = require('../utils/sessionStore');

const sessionCheck = (req, res, next) => {
    // 從 cookie 中提取 session ID
    const sessionID = req.cookies.sessionID;
    // console.log('Cookies:', req.cookies);
    // console.log('Session ID in cookie:', sessionID)

    if (!sessionID) {
        return res.status(401).redirect('/auth/login')  
    }

    // 從 sessionStore 中取得 session 資料
    sessionStore.get(sessionID, (err, sessionData) => {
        if (err || !sessionData) {
            console.error('Session 驗證失敗:', err);
            return res.status(401).redirect('/auth/login')  
            // return res.status(403).json({ message: '無效的 session ID' });
        }

        // 將用戶信息存入 req.user 和 req.tenant
        req.user = {
            id: sessionData.userID,
            email: sessionData.email,
            role: sessionData.role
        };
        req.tenant = {
            id: sessionData.tenantID,
            name: sessionData.tenantName
        };

        next(); // 驗證成功，繼續處理請求
    });
};

module.exports = sessionCheck;


