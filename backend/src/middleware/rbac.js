// backend/src/middleware/rbac.js
// RBAC middleware for EduManage School Platform

const PERMISSIONS = {
  admin: {
    students: { view: true, create: true, edit: true, delete: true },
    teachers: { view: true, create: true, edit: true, delete: true },
    classes:  { view: true, create: true, edit: true, delete: true },
    finance:  { view: true, create: true, edit: true, delete: true },
    parents:  { view: true, create: true, edit: true, delete: true },
    team:     { view: true, create: true, edit: true, delete: true },
    settings: { view: true, create: true, edit: true, delete: true },
  },
  graphic_designer: {
    students: { view: true,  create: false, edit: false, delete: false },
    classes:  { view: true,  create: false, edit: true,  delete: false },
  },
  software_developer: {
    students: { view: true,  create: false, edit: false, delete: false },
    classes:  { view: true,  create: false, edit: true,  delete: false },
  },
  printer: {
    students: { view: true,  create: false, edit: false, delete: false },
    classes:  { view: true,  create: false, edit: true,  delete: false },
  },
  ads_manager: {
    students: { view: true,  create: false, edit: false, delete: false },
    classes:  { view: true,  create: false, edit: true,  delete: false },
  },
};

const SPECIALIST_ROLES = ['graphic_designer', 'software_developer', 'printer', 'ads_manager'];

function deny(res, module, action, role) {
  return res.status(403).json({ error: 'Access denied', required: `${module}:${action}`, your_role: role });
}

function makeGuard(action) {
  return (module) => (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: 'Unauthenticated' });
    const perms = PERMISSIONS[role]?.[module];
    if (perms?.[action]) return next();
    return deny(res, module, action, role);
  };
}

const canView   = makeGuard('view');
const canCreate = makeGuard('create');
const canEdit   = makeGuard('edit');
const canDelete = makeGuard('delete');

const isAdmin = () => (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  return deny(res, 'admin', 'any', req.user?.role);
};

const isAdminOrSpecialist = () => (req, res, next) => {
  const role = req.user?.role;
  if (role === 'admin' || SPECIALIST_ROLES.includes(role)) return next();
  return deny(res, 'platform', 'access', role);
};

module.exports = { PERMISSIONS, SPECIALIST_ROLES, canView, canCreate, canEdit, canDelete, isAdmin, isAdminOrSpecialist };
