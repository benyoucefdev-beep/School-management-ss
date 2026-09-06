// backend/src/middleware/rbac.js
// RBAC for EduManage. One role model, defined here and nowhere else.
//
// Staff roles: admin > manager > member.
// Portal roles (student / teacher / parent) are NOT staff and get nothing here —
// their own routes authorise them separately.
//
// The agency-era roles (graphic_designer, printer, …) are mapped onto the staff
// roles so existing user rows keep working without a data migration.

const STAFF_ROLES = ['admin', 'manager', 'member'];
const PORTAL_ROLES = ['student', 'teacher', 'parent'];

// Legacy role names -> current staff roles.
const ROLE_ALIASES = {
  owner: 'admin',
  staff: 'member',
  graphic_designer: 'member',
  software_developer: 'member',
  printer: 'member',
  ads_manager: 'member',
};

const normalizeRole = (role) => ROLE_ALIASES[role] || role;

const ALL = { view: true, create: true, edit: true, delete: true };
const READ = { view: true, create: false, edit: false, delete: false };
const NONE = { view: false, create: false, edit: false, delete: false };

const PERMISSIONS = {
  admin: {
    students: ALL, teachers: ALL, classes: ALL, finance: ALL,
    parents: ALL, team: ALL, settings: ALL,
  },
  // Runs the school day to day, but cannot delete records, manage staff
  // accounts, or change system settings.
  manager: {
    students: { view: true, create: true, edit: true, delete: false },
    teachers: { view: true, create: true, edit: true, delete: false },
    classes:  { view: true, create: true, edit: true, delete: true  },
    finance:  { view: true, create: true, edit: true, delete: false },
    parents:  { view: true, create: true, edit: true, delete: false },
    team:     READ,
    settings: READ,
  },
  // Teaching / office staff: sees the school, edits only class records.
  member: {
    students: READ,
    teachers: READ,
    classes:  { view: true, create: true, edit: true, delete: false },
    finance:  NONE,
    parents:  NONE,
    team:     NONE,
    settings: NONE,
  },
};

function deny(res, module, action, role) {
  return res.status(403).json({
    error: 'Access denied',
    required: `${module}:${action}`,
    your_role: role,
  });
}

function makeGuard(action) {
  return (module) => (req, res, next) => {
    const rawRole = req.user?.role;
    if (!rawRole) return res.status(401).json({ error: 'Unauthenticated' });
    const role = normalizeRole(rawRole);
    if (PERMISSIONS[role]?.[module]?.[action]) return next();
    return deny(res, module, action, rawRole);
  };
}

const canView   = makeGuard('view');
const canCreate = makeGuard('create');
const canEdit   = makeGuard('edit');
const canDelete = makeGuard('delete');

const isAdmin = () => (req, res, next) => {
  const rawRole = req.user?.role;
  if (!rawRole) return res.status(401).json({ error: 'Unauthenticated' });
  if (normalizeRole(rawRole) === 'admin') return next();
  return deny(res, 'admin', 'any', rawRole);
};

// Any staff account. Blocks portal tokens (student/teacher/parent) from every
// route that is meant for school staff.
const isStaff = () => (req, res, next) => {
  const rawRole = req.user?.role;
  if (!rawRole) return res.status(401).json({ error: 'Unauthenticated' });
  if (STAFF_ROLES.includes(normalizeRole(rawRole))) return next();
  return deny(res, 'platform', 'access', rawRole);
};

module.exports = {
  PERMISSIONS,
  STAFF_ROLES,
  PORTAL_ROLES,
  ROLE_ALIASES,
  normalizeRole,
  canView,
  canCreate,
  canEdit,
  canDelete,
  isAdmin,
  isStaff,
  // kept so older imports do not crash; same meaning as isStaff now
  isAdminOrSpecialist: isStaff,
};
