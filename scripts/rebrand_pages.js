const fs = require('fs');
const path = require('path');

function replace(filePath, replacements) {
  const abs = path.join(__dirname, '..', filePath);
  let content = fs.readFileSync(abs, 'utf8');
  for (const [from, to] of replacements) {
    content = content.split(from).join(to);
  }
  fs.writeFileSync(abs, content, 'utf8');
  console.log(`✓ ${filePath}`);
}

// ── ClientsPage.jsx ──────────────────────────────────────────────
replace('frontend/src/pages/ClientsPage.jsx', [
  ['<h1 className="page-title">Clients</h1>', '<h1 className="page-title">Students</h1>'],
  ['total accounts', 'total students'],
  ['id="create-client-btn"', 'id="create-student-btn"'],
  ['<Plus size={16} /> New Client', '<Plus size={16} /> New Student'],
  ['Search clients...', 'Search students...'],
  ['<div className="empty-state-icon"><Building2 size={24} style={{ color: \'var(--text-muted)\' }} /></div>', '<div className="empty-state-icon"><GraduationCap size={24} style={{ color: \'var(--text-muted)\' }} /></div>'],
  ['No clients yet', 'No students yet'],
  ['Add your first client to get started', 'Add your first student to get started'],
  ['🏢 {client.company_name}', '🎓 {client.company_name}'],
  ['Client Name *', 'Student Full Name *'],
  ['Acme Corp', 'Ahmed Benali'],
  ['Contact Name', 'Parent Name'],
  ['Contact Email', 'Parent Email'],
  ['Contact Phone', 'Parent Phone'],
  ['john@acme.com', 'parent@example.com'],
  ['+1-555-0100', '0555 123 456'],
  ['<th>Client Name</th>', '<th>Student Name</th>'],
  ["title=\"Edit client\"", "title=\"Edit student\""],
  ["title=\"Delete client\"", "title=\"Delete student\""],
  ["toast.success('Client created!')", "toast.success('Student added!')"],
  ["toast.success('Client updated!')", "toast.success('Student updated!')"],
  ["toast.success('Client deleted!')", "toast.success('Student deleted!')"],
  ['"Edit Client"', '"Edit Student"'],
  ['"New Client"', '"New Student"'],
  ["'Create Client'", "'Create Student'"],
  ['+ Add a manager…', '+ Add a staff member…'],
  ['Assigned Managers', 'Assigned Staff'],
  ["import { Plus, Search, Building2, Mail, Phone, User, Edit3, Trash2 } from 'lucide-react';",
   "import { Plus, Search, GraduationCap, Mail, Phone, User, Edit3, Trash2 } from 'lucide-react';"],
]);

// ── SuppliersPage.jsx ────────────────────────────────────────────
replace('frontend/src/pages/SuppliersPage.jsx', [
  ['<h1 className="page-title">Suppliers</h1>', '<h1 className="page-title">Teachers</h1>'],
  ['Manage software, printing, and international suppliers', 'Manage your teaching staff'],
  ['<Plus size={16} /> Add Supplier', '<Plus size={16} /> Add Teacher'],
  ['All Suppliers', 'All Teachers'],
  ["{ id: 'software_tool', label: 'Software & Tools' }", "{ id: 'software_tool', label: 'Full-Time' }"],
  ["{ id: 'printing_house', label: 'Printing Houses' }", "{ id: 'printing_house', label: 'Part-Time' }"],
  ["{ id: 'euro_supplier', label: 'Euro Suppliers' }", "{ id: 'euro_supplier', label: 'Contract' }"],
  ['Search suppliers...', 'Search teachers...'],
  ['Search by name or country...', 'Search by name or subject...'],
  ['Supplier Type', 'Teacher Type'],
  ['Supplier name', 'Teacher full name'],
  ['📦 {s.name}', '👨‍🏫 {s.name}'],
  ['No suppliers found', 'No teachers found'],
  ["toast.success('Supplier created successfully')", "toast.success('Teacher added!')"],
  ["toast.success('Supplier updated successfully')", "toast.success('Teacher updated!')"],
  ["toast.success('Supplier deleted')", "toast.success('Teacher deleted!')"],
  ["toast.error(err.response?.data?.error || 'Failed to create supplier')", "toast.error(err.response?.data?.error || 'Failed to add teacher')"],
  ["toast.error(err.response?.data?.error || 'Failed to update supplier')", "toast.error(err.response?.data?.error || 'Failed to update teacher')"],
  ["toast.error(err.response?.data?.error || 'Failed to delete supplier')", "toast.error(err.response?.data?.error || 'Failed to delete teacher')"],
  ['"Edit Supplier"', '"Edit Teacher"'],
  ['"Add Supplier"', '"Add Teacher"'],
  ["'Create Supplier'", "'Save Teacher'"],
  ["title=\"Edit supplier\"", "title=\"Edit teacher\""],
  ["title=\"Delete supplier\"", "title=\"Delete teacher\""],
  ['Country', 'Specialization'],
  ['country', 'specialization'],
  ['Payment Terms', 'Contract Details'],
  ['e.g. Net 30, End of Month', 'e.g. Full-time, 3-month contract'],
]);

// ── TasksPage.jsx ─────────────────────────────────────────────────
replace('frontend/src/pages/TasksPage.jsx', [
  ['<h1 className="page-title">All Tasks</h1>', '<h1 className="page-title">All Classes</h1>'],
  ['tasks{!isAdmin', 'classes{!isAdmin'],
  [' read only', ' — read only'],
  ['id="create-task-btn"', 'id="create-class-btn"'],
  ['<Plus size={16} /> New Task', '<Plus size={16} /> New Class'],
  ['Task Title *', 'Class Title *'],
  ['What needs to be done?', 'e.g. Math - Algebra Chapter 3'],
  ['<label className="form-label">Client *</label>', '<label className="form-label">Student *</label>'],
  ['— Select client —', '— Select student —'],
  ['Service Type', 'Subject'],
  ["toast.success('Task created')", "toast.success('Class created')"],
  ["toast.success('Task updated')", "toast.success('Class updated')"],
  ["toast.success('Task deleted')", "toast.success('Class deleted')"],
  ["toast.error(e.response?.data?.error || 'Failed to create task')", "toast.error(e.response?.data?.error || 'Failed to create class')"],
  ["toast.error(e.response?.data?.error || 'Failed to update')", "toast.error(e.response?.data?.error || 'Failed to update class')"],
  ["toast.error(e.response?.data?.error || 'Failed to delete')", "toast.error(e.response?.data?.error || 'Failed to delete class')"],
  ["'Create Task'", "'Create Class'"],
  ['Search tasks, clients...', 'Search classes, students...'],
  ['Search tasks...', 'Search classes...'],
  ['All Clients', 'All Students'],
  ['All Services', 'All Subjects'],
  ['No Client', 'No Student'],
  ['{clientTasks.length} {clientTasks.length === 1 ? \'task\' : \'tasks\'}', '{clientTasks.length} {clientTasks.length === 1 ? \'class\' : \'classes\'}'],
  ['📁 {clientName}', '🎓 {clientName}'],
  ['Task details...', 'Class description...'],
  ['Internal notes...', 'Teacher notes...'],
  ['What should happen next?', 'Next session plan...'],
  ['Needs After Completing', 'Next Session Plan'],
  ['Click to start working on this task', 'Click to mark as teaching'],
  ['Click to stop working on this task', 'Click to stop teaching'],
  ['Working on', 'Teaching'],
]);

// ── DashboardPage.jsx ─────────────────────────────────────────────
replace('frontend/src/pages/DashboardPage.jsx', [
  ['Active Clients', 'Active Students'],
  ['New Clients', 'New Students'],
  ['Active Suppliers', 'Active Teachers'],
  ['Open Tasks', 'Active Classes'],
  ['Tasks Today', 'Classes Today'],
  ['Clients at Risk', 'Students at Risk'],
  ['Total Revenue', 'Total Tuition'],
  ['clients', 'students'],
  ['Suppliers', 'Teachers'],
]);

// ── InvoicesPage.jsx ──────────────────────────────────────────────
replace('frontend/src/pages/InvoicesPage.jsx', [
  ['<h1 className="page-title">Invoices</h1>', '<h1 className="page-title">Tuition Fees</h1>'],
  ['New Invoice', 'New Fee'],
  ['Create Invoice', 'Create Fee Record'],
  ['Edit Invoice', 'Edit Fee'],
  ['"Invoice"', '"Tuition Fee"'],
  ['invoice created', 'fee record created'],
  ['invoice updated', 'fee record updated'],
  ['invoice deleted', 'fee record deleted'],
  ['Invoice #', 'Fee #'],
  ['Send Invoice', 'Send Receipt'],
]);

// ── PLPage.jsx ────────────────────────────────────────────────────
replace('frontend/src/pages/PLPage.jsx', [
  ['P&L Report', 'Financial Report'],
  ['Profit & Loss', 'Financial Overview'],
  ['<h1 className="page-title">P&L</h1>', '<h1 className="page-title">Financial Report</h1>'],
]);

// ── PortalPage.jsx (Client Portal → Student Portal) ───────────────
replace('frontend/src/pages/PortalPage.jsx', [
  ['Client Portal', 'Student Portal'],
  ['client portal', 'student portal'],
  ['Client Access', 'Student Access'],
  ['client access', 'student access'],
  ['Portal URL', 'Student Portal URL'],
  ['portal for clients', 'portal for students'],
  ['Send to Client', 'Send to Student'],
  ['Client Token', 'Student Token'],
  ['client token', 'student token'],
]);

// ── SupplierPortalPage.jsx (Supplier Portal → Teacher Portal) ─────
replace('frontend/src/pages/SupplierPortalPage.jsx', [
  ['Supplier Portal', 'Teacher Portal'],
  ['supplier portal', 'teacher portal'],
  ['Supplier Access', 'Teacher Access'],
  ['supplier access', 'teacher access'],
  ['Portal URL for Suppliers', 'Portal URL for Teachers'],
  ['Send to Supplier', 'Send to Teacher'],
  ['Supplier Token', 'Teacher Token'],
  ['supplier token', 'teacher token'],
]);

// ── ClientDetailPage.jsx (Client → Student) ───────────────────────
replace('frontend/src/pages/ClientDetailPage.jsx', [
  ['Client Profile', 'Student Profile'],
  ['client profile', 'student profile'],
  ['Edit Client', 'Edit Student'],
  ['Delete Client', 'Delete Student'],
  ['Client Details', 'Student Details'],
  ['Client Notes', 'Student Notes'],
  ['Active Services', 'Enrolled Subjects'],
  ['client deleted', 'student deleted'],
  ['client updated', 'student updated'],
  ['Back to Clients', 'Back to Students'],
  ['Company Name', 'Student Name'],
  ['company_name', 'student_name'],
  ['Contact Name', 'Parent Name'],
  ['Contact Email', 'Parent Email'],
  ['Contact Phone', 'Parent Phone'],
  ['Wallet Balance', 'Payment Balance'],
  ['wallet balance', 'payment balance'],
]);

// ── SupplierDetailPage.jsx (Supplier → Teacher) ───────────────────
replace('frontend/src/pages/SupplierDetailPage.jsx', [
  ['Supplier Profile', 'Teacher Profile'],
  ['supplier profile', 'teacher profile'],
  ['Edit Supplier', 'Edit Teacher'],
  ['Delete Supplier', 'Delete Teacher'],
  ['Supplier Details', 'Teacher Details'],
  ['Back to Suppliers', 'Back to Teachers'],
  ['supplier deleted', 'teacher deleted'],
  ['supplier updated', 'teacher updated'],
  ['Total Owed', 'Salary Owed'],
  ['total owed', 'salary owed'],
  ['Payment Terms', 'Contract Terms'],
]);

console.log('\n✅ Phase 2 complete — all pages updated!');
