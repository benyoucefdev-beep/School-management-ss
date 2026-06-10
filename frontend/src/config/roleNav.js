// frontend/src/config/roleNav.js
// Role-aware navigation configuration for EduManage

import {
  LayoutDashboard, Users, CheckSquare, DollarSign,
  TrendingUp, Truck, Settings, BarChart2, Kanban,
  ClipboardList, Layout, Package, FileText, Star, Cog
} from 'lucide-react';

export const ROLE_LABELS = {
  admin:              'Admin',
  graphic_designer:   'Graphic Designer',
  software_developer: 'Software Developer',
  printer:            'Printer',
  ads_manager:        'Ads Manager',
};

export const ROLE_COLORS = {
  admin:              { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6', dot: '#8b5cf6' },
  graphic_designer:   { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6', dot: '#3b82f6' },
  software_developer: { bg: 'rgba(20,184,166,0.15)', text: '#14b8a6', dot: '#14b8a6' },
  printer:            { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', dot: '#f59e0b' },
  ads_manager:        { bg: 'rgba(249,115,22,0.15)', text: '#f97316', dot: '#f97316' },
};

// Role badge CSS className
export const ROLE_BADGE_CLASS = {
  admin:              'badge-purple',
  graphic_designer:   'badge-blue',
  software_developer: 'badge-teal',
  printer:            'badge-amber',
  ads_manager:        'badge-orange',
};

// Service type each specialist role maps to
export const ROLE_SERVICE_TYPE = {
  graphic_designer:   'graphic_design',
  software_developer: 'dev_transformation',
  printer:            'graphic_design',
  ads_manager:        'digital_marketing',
};

// Section title shown on My Tasks page column 2
export const ROLE_SECTION_LABEL = {
  graphic_designer:   'All Design Tasks',
  software_developer: 'All Dev Tasks',
  printer:            'All Print Tasks',
  ads_manager:        'All Ads Tasks',
};

// Default redirect path after login per role
export const ROLE_DEFAULT_PATH = {
  admin:              '/dashboard',
  graphic_designer:   '/tasks',
  software_developer: '/tasks',
  printer:            '/tasks',
  ads_manager:        '/tasks',
};

// Use { divider: true, label: '...' } for section separators
const NAV_CONFIG = {
  admin: [
    { divider: true, label: 'Overview' },
    { label: 'Dashboard',     path: '/dashboard',        icon: LayoutDashboard },

    { divider: true, label: 'Tasks' },
    { label: 'Tasks',         path: '/tasks',            icon: CheckSquare },

    { divider: true, label: 'Clients & Operations' },
    { label: 'Clients',       path: '/clients',          icon: Users,         subpaths: ['/clients/'] },
    { label: 'Suppliers',     path: '/suppliers',        icon: Truck,         subpaths: ['/suppliers/'] },

    { divider: true, label: 'Finance Section' },
    { label: 'Expenses',      path: '/finance/expenses', icon: DollarSign },
    { label: 'Quotations',    path: '/finance/quotes',   icon: Star },
    { label: 'Invoices',      path: '/finance/invoices', icon: DollarSign },
    { label: 'P&L Report',    path: '/finance/pl',       icon: TrendingUp },
    { label: 'Ads / PPC',     path: '/ads',              icon: TrendingUp,    subpaths: ['/ads/'] },
    { label: 'Exchange & Amounts', path: '/settings',         icon: Cog },

    { divider: true, label: 'Management' },
    { label: 'Team',          path: '/team',             icon: Settings },
  ],

  graphic_designer: [
    { divider: true, label: 'Workspace' },
    { label: 'Tasks',     path: '/tasks',    icon: CheckSquare },
  ],

  software_developer: [
    { divider: true, label: 'Workspace' },
    { label: 'Tasks',     path: '/tasks',    icon: CheckSquare },
  ],

  printer: [
    { divider: true, label: 'Workspace' },
    { label: 'Tasks',     path: '/tasks',    icon: CheckSquare },
    { label: 'Orders',    path: '/orders',   icon: Package },
  ],

  ads_manager: [
    { divider: true, label: 'Workspace' },
    { label: 'Tasks',     path: '/tasks',    icon: CheckSquare },
    { divider: true, label: 'Finance Section' },
    { label: 'Ads / PPC', path: '/ads',      icon: TrendingUp, subpaths: ['/ads/'] },
  ],
};

export default NAV_CONFIG;
