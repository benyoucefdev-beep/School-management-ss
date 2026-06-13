// frontend/src/config/roleNav.js
// Role-aware navigation configuration for EduManage School Platform

import {
  LayoutDashboard, Users, BookOpen, DollarSign,
  TrendingUp, GraduationCap,
  ClipboardList, Layers,
  UserCheck, Baby
} from 'lucide-react';

export const ROLE_LABELS = {
  owner:   'Owner',
  manager: 'Manager',
  member:  'Staff',
  // Legacy roles kept for compatibility
  admin:              'Admin',
  graphic_designer:   'Staff',
  software_developer: 'Staff',
  printer:            'Staff',
  ads_manager:        'Staff',
};

export const ROLE_COLORS = {
  owner:   { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6', dot: '#8b5cf6' },
  manager: { bg: 'rgba(0,180,216,0.15)',  text: '#00b4d8', dot: '#00b4d8' },
  member:  { bg: 'rgba(6,214,160,0.15)',  text: '#06d6a0', dot: '#06d6a0' },
  // Legacy
  admin:              { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6', dot: '#8b5cf6' },
  graphic_designer:   { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6', dot: '#3b82f6' },
  software_developer: { bg: 'rgba(20,184,166,0.15)', text: '#14b8a6', dot: '#14b8a6' },
  printer:            { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', dot: '#f59e0b' },
  ads_manager:        { bg: 'rgba(249,115,22,0.15)', text: '#f97316', dot: '#f97316' },
};

export const ROLE_BADGE_CLASS = {
  owner:              'badge-purple',
  manager:            'badge-teal',
  member:             'badge-blue',
  admin:              'badge-purple',
  graphic_designer:   'badge-blue',
  software_developer: 'badge-teal',
  printer:            'badge-amber',
  ads_manager:        'badge-orange',
};

export const ROLE_SERVICE_TYPE = {
  graphic_designer:   'graphic_design',
  software_developer: 'dev_transformation',
  printer:            'graphic_design',
  ads_manager:        'digital_marketing',
};

export const ROLE_SECTION_LABEL = {
  graphic_designer:   'All Design Tasks',
  software_developer: 'All Dev Tasks',
  printer:            'All Print Tasks',
  ads_manager:        'All Ads Tasks',
};

// Default redirect path after login per role
export const ROLE_DEFAULT_PATH = {
  owner:              '/dashboard',
  manager:            '/dashboard',
  member:             '/classes',
  admin:              '/dashboard',
  graphic_designer:   '/classes',
  software_developer: '/classes',
  printer:            '/classes',
  ads_manager:        '/classes',
};

// ─── Navigation config per role ───────────────────────────────────────────────
// Use { divider: true, label: '...' } for section separators
const NAV_CONFIG = {
  // Owner sees everything
  admin: [
    { divider: true, label: 'Overview' },
    { label: 'Dashboard',         path: '/dashboard',         icon: LayoutDashboard },

    { divider: true, label: 'School' },
    { label: 'Students',          path: '/students',           icon: GraduationCap, subpaths: ['/clients/'] },
    { label: 'Teachers',          path: '/teachers',         icon: Users,         subpaths: ['/suppliers/'] },
    { label: 'Groups',            path: '/groups',            icon: Layers },
    { label: 'Subjects',          path: '/subjects',          icon: BookOpen },
    { label: 'Classes',           path: '/classes',             icon: ClipboardList },
    { label: 'Parents',           path: '/parents',           icon: Baby },

    { divider: true, label: 'Finance' },
    { label: 'Tuition Fees',      path: '/finance/invoices',  icon: DollarSign },
    { label: 'Expenses',          path: '/finance/expenses',  icon: ClipboardList },
    { label: 'Financial Report',  path: '/finance/pl',        icon: TrendingUp },

    { divider: true, label: 'Management' },
    { label: 'Team',              path: '/team',              icon: UserCheck },
  ],

  // Owner alias — same as admin
  owner: [
    { divider: true, label: 'Overview' },
    { label: 'Dashboard',         path: '/dashboard',         icon: LayoutDashboard },

    { divider: true, label: 'School' },
    { label: 'Students',          path: '/students',          icon: GraduationCap, subpaths: ['/students/'] },
    { label: 'Teachers',          path: '/teachers',          icon: Users,          subpaths: ['/teachers/'] },
    { label: 'Groups',            path: '/groups',            icon: Layers },
    { label: 'Subjects',          path: '/subjects',          icon: BookOpen },
    { label: 'Classes',           path: '/classes',           icon: ClipboardList },
    { label: 'Parents',           path: '/parents',           icon: Baby },

    { divider: true, label: 'Finance' },
    { label: 'Tuition Fees',      path: '/finance/invoices',  icon: DollarSign },
    { label: 'Expenses',          path: '/finance/expenses',  icon: ClipboardList },
    { label: 'Financial Report',  path: '/finance/pl',        icon: TrendingUp },

    { divider: true, label: 'Management' },
    { label: 'Team',              path: '/team',              icon: UserCheck },
  ],

  manager: [
    { divider: true, label: 'Overview' },
    { label: 'Dashboard',         path: '/dashboard',         icon: LayoutDashboard },

    { divider: true, label: 'School' },
    { label: 'Students',          path: '/students',          icon: GraduationCap, subpaths: ['/students/'] },
    { label: 'Teachers',          path: '/teachers',          icon: Users,          subpaths: ['/teachers/'] },
    { label: 'Groups',            path: '/groups',            icon: Layers },
    { label: 'Subjects',          path: '/subjects',          icon: BookOpen },
    { label: 'Classes',           path: '/classes',           icon: ClipboardList },
    { label: 'Parents',           path: '/parents',           icon: Baby },
  ],

  member: [
    { divider: true, label: 'Workspace' },
    { label: 'Dashboard',         path: '/dashboard',         icon: LayoutDashboard },
    { label: 'Classes',           path: '/classes',           icon: BookOpen },
  ],
};

export default NAV_CONFIG;
