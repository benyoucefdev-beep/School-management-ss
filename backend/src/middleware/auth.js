const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// Allows access if user has one of the allowed roles OR if the user is the owner of the resource
const authorizeOwnerOrRoles = (...roles) => (req, res, next) => {
  if (roles.includes(req.user.role)) return next();
  // passing: will be refined in route handlers using req.user.id
  req._memberSelfOnly = true;
  next();
};

module.exports = { authenticate, authorize, authorizeOwnerOrRoles };
