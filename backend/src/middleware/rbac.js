// backend/src/middleware/rbac.js
// New 5-role RBAC middleware for Axialogy

const PERMISSIONS = {
  admin: {
    clients:   { view: true,  create: true,  edit: true,  delete: true  },
    tasks:     { view: true,  create: true,  edit: true,  delete: true  },
    finance:   { view: true,  create: true,  edit: true,  delete: true  },
    ads:       { view: true,  create: true,  edit: true,  delete: true  },
    suppliers: { view: true,  create: true,  edit: true,  delete: true  },
    team:      { view: true,  create: true,  edit: true,  delete: true  },
    reports:   { view: true,  create: true,  edit: true,  delete: true  },
    pipeline:  { view: true,  create: true,  edit: true,  delete: true  },
    settings:  { view: true,  create: true,  edit: true,  delete: true  },
    orders:    { view: true,  create: true,  edit: true,  delete: true  },
  },
  graphic_designer: {
    tasks:   { view: true, create: false, edit: true,  delete: false },
    clients: { view: false, create: false, edit: false, delete: false },
  },
  software_developer: {
    tasks:   { view: true, create: false, edit: true,  delete: false },
    clients: { view: false, create: false, edit: false, delete: false },
  },
  printer: {
    tasks:   { view: true, create: false, edit: true,  delete: false },
    clients: { view: false, create: false, edit: false, delete: false },
    orders:  { view: true, create: false, edit: false, delete: false },
  },
  ads_manager: {
    tasks:   { view: true, create: false, edit: true,  delete: false },
    clients: { view: false, create: false, edit: false, delete: false },
    ads:     { view: true, create: true,  edit: true,  delete: false },
  },
};

// Map each specialist role to the service_type they are responsible for
const ROLE_SERVICE_TYPE = {
  graphic_designer:   'graphic_design',
  software_developer: 'dev_transformation',
  printer:            'graphic_design',  // printers handle print output from design tasks
  ads_manager:        'digital_marketing',
};

const SPECIALIST_ROLES = ['graphic_designer', 'software_developer', 'printer', 'ads_manager'];

function deny(res, module, action, role) {
  return res.status(403).json({
    error: 'Access denied',
    required: `${module}:${action}`,
    your_role: role,
  });
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

/** isAdmin — only allows role === 'admin' */
const isAdmin = () => (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  return deny(res, 'admin', 'any', req.user?.role);
};

/** isAdminOrSpecialist — allows admin + all 4 specialist roles */
const isAdminOrSpecialist = () => (req, res, next) => {
  const role = req.user?.role;
  if (role === 'admin' || SPECIALIST_ROLES.includes(role)) return next();
  return deny(res, 'platform', 'access', role);
};

module.exports = {
  PERMISSIONS,
  ROLE_SERVICE_TYPE,
  SPECIALIST_ROLES,
  canView,
  canCreate,
  canEdit,
  canDelete,
  isAdmin,
  isAdminOrSpecialist,
};
