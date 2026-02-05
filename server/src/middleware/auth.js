import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'afs-super-secret-key-2025-change-me-in-production';

export const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: '未登录，请先登录' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; 
    next();
  } catch (err) {
    return res.status(401).json({ 
      success: false,
      message: '登录已过期，请重新登录' 
    });
  }
};
