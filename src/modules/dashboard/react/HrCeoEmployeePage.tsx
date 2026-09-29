import React, { useState, useEffect } from 'react';

// Types & Interfaces
export interface BankDetails {
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  ifscCode?: string;
}

export interface EmergencyContact {
  name?: string;
  phone?: string;
  relationship?: string;
}

export interface LeaveBalances {
  casual: number;
  sick: number;
  annual: number;
  maternity: number;
  paternity: number;
  lossOfPay: number;
}

export interface MonthlyMetrics {
  presentDays: number;
  lateDays: number;
  latePenaltyHalfDays: number;
  halfDays: number;
  permissionHoursUsed: number;
}

export interface EmployeeRow {
  id: string; // Employee ID e.g. "WG-EMP-014"
  _id: string; // MongoDB ObjectId
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  gender: string;
  dateOfJoining: string;
  branch: string;
  department: string;
  designation: string;
  isActive: boolean;
  checkin: string;
  checkout: string;
  todayStatus: string;
  isLate: boolean;
  lateMinutes: number;
  isLatePenaltyApplied: boolean;
  locationAddress: string;
  bankDetails: BankDetails;
  emergencyContact: EmergencyContact;
  leaveBalances: LeaveBalances;
  monthlyMetrics: MonthlyMetrics;
}

export interface LeaveItem {
  _id: string;
  userId: {
    name: string;
    employeeId: string;
    email: string;
    branch: string;
    department: string;
  };
  leaveType: string;
  fromDate: string;
  toDate: string;
  days: number;
  paidDays: number;
  lopDays: number;
  isLop: boolean;
  lopReason?: string;
  reason: string;
  medicalCertificateUrl?: string;
  isMedicalCertificateVerified: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewComments?: string;
}

export interface BranchItem {
  _id: string;
  name: string;
  code: string;
  city: string;
  address: string;
  employeeCount?: number;
  isActive: boolean;
}

export const HrCeoEmployeePage: React.FC = () => {
  // State Management
  const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'LEAVES' | 'BRANCHES'>('EMPLOYEES');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modal / Popup State
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'PROFILE' | 'BANK' | 'ATTENDANCE' | 'LEAVES'>('PROFILE');
  const [showAddBranchModal, setShowAddBranchModal] = useState<boolean>(false);
  const [newBranchForm, setNewBranchForm] = useState({
    name: '',
    code: '',
    city: '',
    state: '',
    address: '',
    radiusMeters: 500,
  });

  // Base API configuration (Defaults to window.location.origin or relative path)
  const API_BASE = '/api/v1';

  // Fetch Branches
  const fetchBranches = async () => {
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE}/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setBranches(json.data);
      }
    } catch (err) {
      console.error('Error fetching branches:', err);
    }
  };

  // Fetch Employees
  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const params = new URLSearchParams();
      if (selectedBranch !== 'ALL') params.append('branch', selectedBranch);
      if (selectedDept !== 'ALL') params.append('dept', selectedDept);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`${API_BASE}/dashboard/hr-ceo/employees?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setEmployees(json.data);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Leaves
  const fetchLeaves = async () => {
    try {
      const token = localStorage.getItem('token') || '';
      const params = new URLSearchParams();
      if (selectedBranch !== 'ALL') params.append('branch', selectedBranch);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`${API_BASE}/leaves/hr/list?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setLeaves(json.data);
      }
    } catch (err) {
      console.error('Error fetching leaves:', err);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (activeTab === 'EMPLOYEES') {
      fetchEmployees();
    } else if (activeTab === 'LEAVES') {
      fetchLeaves();
    }
  }, [activeTab, selectedBranch, selectedDept, selectedStatus, searchQuery]);

  // Handle Download Individual Report
  const handleDownloadIndividualReport = async (emp: EmployeeRow) => {
    try {
      const token = localStorage.getItem('token') || '';
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const res = await fetch(
        `${API_BASE}/dashboard/hr-ceo/employees/${emp._id}/export-report?month=${month}&year=${year}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report-${emp.employeeId}-${emp.name.replace(/\s+/g, '_')}-${month}-${year}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert('Failed to download employee statement');
    }
  };

  // Handle Review Leave
  const handleReviewLeave = async (leaveId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const token = localStorage.getItem('token') || '';
      const comments = prompt(`Enter optional remarks for ${action.toLowerCase()}:`) || '';
      const res = await fetch(`${API_BASE}/leaves/manager/${leaveId}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, comments }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`Leave request ${action.toLowerCase()}d successfully`);
        fetchLeaves();
      }
    } catch (err) {
      alert('Action failed');
    }
  };

  // Handle Create New Branch
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE}/branches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newBranchForm),
      });
      const json = await res.json();
      if (json.success) {
        alert('New branch added successfully!');
        setShowAddBranchModal(false);
        setNewBranchForm({ name: '', code: '', city: '', state: '', address: '', radiusMeters: 500 });
        fetchBranches();
      } else {
        alert(json.message || 'Failed to create branch');
      }
    } catch (err) {
      alert('Failed to create branch');
    }
  };

  // KPI Calculations
  const totalEmployeesCount = employees.length;
  const checkedInCount = employees.filter((e) => e.checkin && e.checkin !== '-').length;
  const lateArrivalsCount = employees.filter((e) => e.isLate).length;
  const halfDayPenaltiesCount = employees.filter((e) => e.isLatePenaltyApplied).length;
  const onLeaveCount = employees.filter((e) => e.todayStatus === 'LEAVE').length;

  return (
    <div style={styles.container}>
      {/* 1. TOP HEADER & SHIFT POLICY BANNER */}
      <header style={styles.header}>
        <div style={styles.headerTitleGroup}>
          <div style={styles.badgeCompany}>WEGROW CAMPUS SUITE</div>
          <h1 style={styles.mainTitle}>HR & Executive Attendance Dashboard</h1>
          <p style={styles.subTitle}>
            Multi-Branch Real-Time Monitoring • Geolocation Validation • Late & LOP Salary Rules Engine
          </p>
        </div>

        {/* Shift Timings & Grace Rules Pill */}
        <div style={styles.policyPill}>
          <div style={styles.policyRow}>
            <span style={styles.policyLabel}>Standard Shift:</span>
            <strong style={styles.policyValue}>09:40 AM – 07:00 PM</strong>
          </div>
          <div style={styles.policyRow}>
            <span style={styles.policyLabel}>Grace Window:</span>
            <span style={styles.policyHighlight}>09:45 AM (Max 3 Allowed / Month)</span>
          </div>
          <div style={styles.policyRow}>
            <span style={styles.policyLabel}>Penalties:</span>
            <span style={styles.policyWarning}>4th Late Arrival = 0.5 Day Salary Deduction | &gt;2h Permission = 0.5 Day Deduction</span>
          </div>
        </div>
      </header>

      {/* 2. KPI METRICS CARDS */}
      <div style={styles.kpiGrid}>
        <div style={{ ...styles.kpiCard, borderLeft: '4px solid #3b82f6' }}>
          <div style={styles.kpiLabel}>Total Employees</div>
          <div style={styles.kpiNumber}>{totalEmployeesCount}</div>
          <div style={styles.kpiMeta}>Active in {branches.length || 3} Branches</div>
        </div>

        <div style={{ ...styles.kpiCard, borderLeft: '4px solid #10b981' }}>
          <div style={styles.kpiLabel}>Checked In Today</div>
          <div style={{ ...styles.kpiNumber, color: '#10b981' }}>{checkedInCount}</div>
          <div style={styles.kpiMeta}>
            {totalEmployeesCount > 0 ? `${((checkedInCount / totalEmployeesCount) * 100).toFixed(0)}% attendance rate` : '0%'}
          </div>
        </div>

        <div style={{ ...styles.kpiCard, borderLeft: '4px solid #f59e0b' }}>
          <div style={styles.kpiLabel}>Late Arrivals Today</div>
          <div style={{ ...styles.kpiNumber, color: '#f59e0b' }}>{lateArrivalsCount}</div>
          <div style={styles.kpiMeta}>Punched past 09:40 AM (Grace 09:45)</div>
        </div>

        <div style={{ ...styles.kpiCard, borderLeft: '4px solid #ef4444' }}>
          <div style={styles.kpiLabel}>4th Late Penalties</div>
          <div style={{ ...styles.kpiNumber, color: '#ef4444' }}>{halfDayPenaltiesCount}</div>
          <div style={styles.kpiMeta}>Half-day salary deductions triggered</div>
        </div>

        <div style={{ ...styles.kpiCard, borderLeft: '4px solid #8b5cf6' }}>
          <div style={styles.kpiLabel}>On Leave / LOP</div>
          <div style={{ ...styles.kpiNumber, color: '#8b5cf6' }}>{onLeaveCount}</div>
          <div style={styles.kpiMeta}>Approved Casual / Medical</div>
        </div>
      </div>

      {/* 3. NAVIGATION TABS */}
      <div style={styles.navBar}>
        <div style={styles.navTabs}>
          <button
            style={activeTab === 'EMPLOYEES' ? styles.activeTabBtn : styles.tabBtn}
            onClick={() => setActiveTab('EMPLOYEES')}
          >
            👥 Employee Details & Attendance Table
          </button>
          <button
            style={activeTab === 'LEAVES' ? styles.activeTabBtn : styles.tabBtn}
            onClick={() => setActiveTab('LEAVES')}
          >
            📋 Employee Leave Management & Medical Proofs
          </button>
          <button
            style={activeTab === 'BRANCHES' ? styles.activeTabBtn : styles.tabBtn}
            onClick={() => setActiveTab('BRANCHES')}
          >
            🏢 Company Branches ({branches.length})
          </button>
        </div>

        {activeTab === 'BRANCHES' && (
          <button style={styles.addBtn} onClick={() => setShowAddBranchModal(true)}>
            + Add New Branch
          </button>
        )}
      </div>

      {/* 4. FILTER BAR */}
      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>🏢 Branch Filter:</label>
          <select
            style={styles.selectInput}
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="ALL">All Branches ({branches.length})</option>
            {branches.map((b) => (
              <option key={b._id} value={b.name}>
                {b.name} ({b.city})
              </option>
            ))}
          </select>
        </div>

        {activeTab === 'EMPLOYEES' && (
          <>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>📂 Department:</label>
              <select
                style={styles.selectInput}
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
              >
                <option value="ALL">All Departments</option>
                <option value="Technology">Technology</option>
                <option value="HR">HR</option>
                <option value="Skill Campus">Skill Campus</option>
                <option value="B School">B School</option>
                <option value="Executive & Admin">Executive & Admin</option>
              </select>
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>⚡ Status:</label>
              <select
                style={styles.selectInput}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Employees</option>
                <option value="INACTIVE">Inactive Employees</option>
              </select>
            </div>
          </>
        )}

        <div style={{ ...styles.filterGroup, flex: 1, minWidth: '220px' }}>
          <label style={styles.filterLabel}>🔍 Search Employee:</label>
          <input
            style={styles.textInput}
            placeholder="Search by name, employee ID, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 5. TAB CONTENT 1: EMPLOYEES TABLE */}
      {activeTab === 'EMPLOYEES' && (
        <div style={styles.tableCard}>
          <div style={styles.tableHeaderSection}>
            <h2 style={styles.tableTitle}>
              Employee Directory & Today's Attendance Sheet ({employees.length})
            </h2>
            <span style={styles.tableSubtitle}>
              Click <strong>"View Details"</strong> for complete user & bank account details, or download individual statements.
            </span>
          </div>

          {isLoading ? (
            <div style={styles.loadingState}>Loading employee records...</div>
          ) : employees.length === 0 ? (
            <div style={styles.emptyState}>No employee records found matching current filters.</div>
          ) : (
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeadRow}>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Date of Joining</th>
                    <th style={styles.th}>Branch</th>
                    <th style={styles.th}>Check-in</th>
                    <th style={styles.th}>Check-out</th>
                    <th style={styles.th}>Today Status</th>
                    <th style={styles.th}>Late Counter</th>
                    <th style={styles.th}>Active</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp._id} style={styles.tableRow}>
                      {/* ID */}
                      <td style={styles.td}>
                        <span style={styles.empIdBadge}>{emp.employeeId}</span>
                      </td>

                      {/* Name & Designation */}
                      <td style={styles.td}>
                        <div style={styles.empNameBlock}>
                          <strong>{emp.name}</strong>
                          <span style={styles.empRoleText}>{emp.designation} • {emp.department}</span>
                        </div>
                      </td>

                      {/* Date of Joining */}
                      <td style={styles.td}>{emp.dateOfJoining}</td>

                      {/* Branch */}
                      <td style={styles.td}>
                        <span style={styles.branchBadge}>📍 {emp.branch}</span>
                      </td>

                      {/* Check-in */}
                      <td style={styles.td}>
                        {emp.checkin !== '-' ? (
                          <div style={styles.checkTimeBlock}>
                            <strong>{emp.checkin}</strong>
                            {emp.isLate && (
                              <span style={emp.isLatePenaltyApplied ? styles.penaltyBadge : styles.lateBadge}>
                                {emp.isLatePenaltyApplied ? '0.5d Penalty' : `Late (+${emp.lateMinutes}m)`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>

                      {/* Check-out */}
                      <td style={styles.td}>
                        {emp.checkout !== '-' ? <strong>{emp.checkout}</strong> : <span style={{ color: '#94a3b8' }}>-</span>}
                      </td>

                      {/* Status */}
                      <td style={styles.td}>
                        <span style={getStatusStyle(emp.todayStatus, emp.isLatePenaltyApplied)}>
                          {emp.isLatePenaltyApplied ? 'HALF DAY (PENALTY)' : emp.todayStatus}
                        </span>
                      </td>

                      {/* Late Counter this month */}
                      <td style={styles.td}>
                        <span
                          style={{
                            fontWeight: '600',
                            color: emp.monthlyMetrics.lateDays >= 4 ? '#ef4444' : emp.monthlyMetrics.lateDays > 0 ? '#f59e0b' : '#10b981',
                          }}
                        >
                          {emp.monthlyMetrics.lateDays}/3 Allowed
                        </span>
                      </td>

                      {/* Active Toggle */}
                      <td style={styles.td}>
                        <span style={emp.isActive ? styles.activeBadge : styles.inactiveBadge}>
                          {emp.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <div style={styles.actionButtonGroup}>
                          <button
                            style={styles.viewDetailBtn}
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setIsModalOpen(true);
                            }}
                          >
                            👁️ View Details
                          </button>
                          <button
                            style={styles.downloadBtn}
                            title="Download monthly statement"
                            onClick={() => handleDownloadIndividualReport(emp)}
                          >
                            📥 Report
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. TAB CONTENT 2: LEAVES & MEDICAL CERTIFICATES */}
      {activeTab === 'LEAVES' && (
        <div style={styles.tableCard}>
          <div style={styles.tableHeaderSection}>
            <h2 style={styles.tableTitle}>Employee Leave Requests & Medical Certificates</h2>
            <span style={styles.tableSubtitle}>
              Rule: Casual Leave limit is 1/month (excess is LOP). Sick Leave requires uploaded medical certificate otherwise marked as LOP.
            </span>
          </div>

          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeadRow}>
                  <th style={styles.th}>Employee</th>
                  <th style={styles.th}>Branch</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Duration</th>
                  <th style={styles.th}>Days (Paid / LOP)</th>
                  <th style={styles.th}>Medical Certificate</th>
                  <th style={styles.th}>Reason</th>
                  <th style={styles.th}>Status</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((leave) => (
                  <tr key={leave._id} style={styles.tableRow}>
                    <td style={styles.td}>
                      <strong>{leave.userId?.name || 'Staff'}</strong>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{leave.userId?.employeeId}</div>
                    </td>
                    <td style={styles.td}>📍 {leave.userId?.branch || 'Main Campus'}</td>
                    <td style={styles.td}>
                      <span style={styles.leaveTypeBadge}>{leave.leaveType}</span>
                    </td>
                    <td style={styles.td}>
                      {leave.fromDate} to {leave.toDate}
                    </td>
                    <td style={styles.td}>
                      <div><strong>{leave.days} Day(s)</strong></div>
                      {leave.isLop && (
                        <span style={styles.lopBadge}>LOP: {leave.lopDays}d</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      {leave.medicalCertificateUrl ? (
                        <a
                          href={leave.medicalCertificateUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.certLink}
                        >
                          📄 View Certificate
                        </a>
                      ) : leave.leaveType === 'SICK' ? (
                        <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'bold' }}>
                          ⚠️ No Certificate (LOP)
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>
                    <td style={styles.td}>{leave.reason}</td>
                    <td style={styles.td}>
                      <span style={getStatusStyle(leave.status, false)}>{leave.status}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      {leave.status === 'PENDING' ? (
                        <div style={styles.actionButtonGroup}>
                          <button
                            style={styles.approveBtn}
                            onClick={() => handleReviewLeave(leave._id, 'APPROVE')}
                          >
                            ✓ Approve
                          </button>
                          <button
                            style={styles.rejectBtn}
                            onClick={() => handleReviewLeave(leave._id, 'REJECT')}
                          >
                            ✗ Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. TAB CONTENT 3: BRANCHES MANAGEMENT */}
      {activeTab === 'BRANCHES' && (
        <div style={styles.branchGrid}>
          {branches.map((b) => (
            <div key={b._id} style={styles.branchCard}>
              <div style={styles.branchHeader}>
                <h3 style={styles.branchName}>{b.name}</h3>
                <span style={styles.branchCode}>{b.code}</span>
              </div>
              <p style={styles.branchAddress}>📍 {b.address}, {b.city}</p>
              <div style={styles.branchFooter}>
                <span style={styles.branchCount}>👥 {b.employeeCount || 0} Employees Assigned</span>
                <span style={b.isActive ? styles.activeBadge : styles.inactiveBadge}>
                  {b.isActive ? 'Active Campus' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 8. POPUP MODAL: SHOW EMPLOYEE ALL DETAILS + BANK ACCOUNT DETAILS */}
      {isModalOpen && selectedEmployee && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            {/* Modal Header */}
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>{selectedEmployee.name}</h2>
                <div style={styles.modalSubHeader}>
                  <span>ID: <strong>{selectedEmployee.employeeId}</strong></span> •{' '}
                  <span>Branch: <strong>{selectedEmployee.branch}</strong></span> •{' '}
                  <span>Designation: <strong>{selectedEmployee.designation}</strong></span>
                </div>
              </div>
              <button style={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={styles.modalTabs}>
              <button
                style={modalTab === 'PROFILE' ? styles.modalTabActive : styles.modalTab}
                onClick={() => setModalTab('PROFILE')}
              >
                👤 User Profile
              </button>
              <button
                style={modalTab === 'BANK' ? styles.modalTabActive : styles.modalTab}
                onClick={() => setModalTab('BANK')}
              >
                💳 Bank Account Details
              </button>
              <button
                style={modalTab === 'ATTENDANCE' ? styles.modalTabActive : styles.modalTab}
                onClick={() => setModalTab('ATTENDANCE')}
              >
                ⏱️ Check-in & GPS Location
              </button>
              <button
                style={modalTab === 'LEAVES' ? styles.modalTabActive : styles.modalTab}
                onClick={() => setModalTab('LEAVES')}
              >
                🌴 Balances & Monthly Stats
              </button>
            </div>

            {/* Modal Body */}
            <div style={styles.modalBody}>
              {/* TAB 1: User Profile */}
              {modalTab === 'PROFILE' && (
                <div style={styles.infoGrid}>
                  <div style={styles.infoItem}>
                    <label style={styles.infoLabel}>Full Name</label>
                    <div style={styles.infoValue}>{selectedEmployee.name}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <label style={styles.infoLabel}>Official Email</label>
                    <div style={styles.infoValue}>{selectedEmployee.email}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <label style={styles.infoLabel}>Phone Number</label>
                    <div style={styles.infoValue}>{selectedEmployee.phone}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <label style={styles.infoLabel}>Date of Joining</label>
                    <div style={styles.infoValue}>{selectedEmployee.dateOfJoining}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <label style={styles.infoLabel}>Department</label>
                    <div style={styles.infoValue}>{selectedEmployee.department}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <label style={styles.infoLabel}>Campus Branch</label>
                    <div style={styles.infoValue}>📍 {selectedEmployee.branch}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <label style={styles.infoLabel}>Gender</label>
                    <div style={styles.infoValue}>{selectedEmployee.gender}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <label style={styles.infoLabel}>Account Status</label>
                    <div style={styles.infoValue}>
                      <span style={selectedEmployee.isActive ? styles.activeBadge : styles.inactiveBadge}>
                        {selectedEmployee.isActive ? 'Active User' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Bank Account Details */}
              {modalTab === 'BANK' && (
                <div style={styles.bankCardBox}>
                  <div style={styles.bankCardHeader}>
                    <span style={styles.bankChip}>🏦 Verified Payroll Account</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Direct Deposit Active</span>
                  </div>
                  <div style={styles.infoGrid}>
                    <div style={styles.infoItem}>
                      <label style={styles.infoLabel}>Account Holder Name</label>
                      <div style={styles.infoValue}>
                        {selectedEmployee.bankDetails.accountName || selectedEmployee.name}
                      </div>
                    </div>
                    <div style={styles.infoItem}>
                      <label style={styles.infoLabel}>Account Number</label>
                      <div style={{ ...styles.infoValue, fontFamily: 'monospace', fontSize: '16px', letterSpacing: '1px' }}>
                        {selectedEmployee.bankDetails.accountNumber || 'Not Provided'}
                      </div>
                    </div>
                    <div style={styles.infoItem}>
                      <label style={styles.infoLabel}>Bank Name</label>
                      <div style={styles.infoValue}>
                        {selectedEmployee.bankDetails.bankName || 'Not Provided'}
                      </div>
                    </div>
                    <div style={styles.infoItem}>
                      <label style={styles.infoLabel}>IFSC Code</label>
                      <div style={{ ...styles.infoValue, fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {selectedEmployee.bankDetails.ifscCode || 'Not Provided'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Today Attendance & Location Details */}
              {modalTab === 'ATTENDANCE' && (
                <div style={styles.infoGrid}>
                  <div style={styles.infoItem}>
                    <label style={styles.infoLabel}>Today's Punch In</label>
                    <div style={{ ...styles.infoValue, color: '#10b981', fontWeight: 'bold' }}>
                      {selectedEmployee.checkin}
                    </div>
                  </div>
                  <div style={styles.infoItem}>
                    <label style={styles.infoLabel}>Today's Punch Out</label>
                    <div style={{ ...styles.infoValue, color: '#3b82f6', fontWeight: 'bold' }}>
                      {selectedEmployee.checkout}
                    </div>
                  </div>
                  <div style={styles.infoItem}>
                    <label style={styles.infoLabel}>Location Address & Verification</label>
                    <div style={styles.infoValue}>
                      📍 {selectedEmployee.locationAddress || `${selectedEmployee.branch} Office Premises`}
                    </div>
                  </div>
                  <div style={styles.infoItem}>
                    <label style={styles.infoLabel}>Late Arrival Flag (Past 09:40 AM)</label>
                    <div style={styles.infoValue}>
                      {selectedEmployee.isLate ? (
                        <span style={selectedEmployee.isLatePenaltyApplied ? styles.penaltyBadge : styles.lateBadge}>
                          Late Arrival (+{selectedEmployee.lateMinutes} mins)
                        </span>
                      ) : (
                        <span style={{ color: '#10b981', fontWeight: '600' }}>✓ On Time</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Balances, Late Summary, & Monthly Permissions */}
              {modalTab === 'LEAVES' && (
                <div>
                  <div style={styles.statsSummaryGrid}>
                    <div style={styles.statsBox}>
                      <div style={styles.statsTitle}>Late Check-ins This Month</div>
                      <div style={{ ...styles.statsNum, color: selectedEmployee.monthlyMetrics.lateDays >= 4 ? '#ef4444' : '#f59e0b' }}>
                        {selectedEmployee.monthlyMetrics.lateDays} / 3 Allowed
                      </div>
                      <div style={styles.statsDesc}>
                        {selectedEmployee.monthlyMetrics.lateDays >= 4 ? '4th Late: Half-Day salary deduction applied' : 'Within allowed monthly grace'}
                      </div>
                    </div>

                    <div style={styles.statsBox}>
                      <div style={styles.statsTitle}>Permissions Used</div>
                      <div style={{ ...styles.statsNum, color: selectedEmployee.monthlyMetrics.permissionHoursUsed > 2 ? '#ef4444' : '#3b82f6' }}>
                        {selectedEmployee.monthlyMetrics.permissionHoursUsed} / 2.0 hrs
                      </div>
                      <div style={styles.statsDesc}>
                        {selectedEmployee.monthlyMetrics.permissionHoursUsed > 2 ? 'Exceeded 2 hrs: Half-day salary deducted' : 'Within 2.0 hrs allowed limit'}
                      </div>
                    </div>

                    <div style={styles.statsBox}>
                      <div style={styles.statsTitle}>Loss of Pay (LOP) Days</div>
                      <div style={{ ...styles.statsNum, color: '#ef4444' }}>
                        {selectedEmployee.leaveBalances.lossOfPay} Days
                      </div>
                      <div style={styles.statsDesc}>Unpaid leaves / unverified sick leaves</div>
                    </div>
                  </div>

                  <h4 style={{ margin: '16px 0 8px', color: '#1e293b' }}>Leave Quota Balances</h4>
                  <div style={styles.leaveBalanceRow}>
                    <div style={styles.balancePill}>Casual: <strong>{selectedEmployee.leaveBalances.casual}</strong> (1/mo)</div>
                    <div style={styles.balancePill}>Sick/Medical: <strong>{selectedEmployee.leaveBalances.sick}</strong></div>
                    <div style={styles.balancePill}>Annual: <strong>{selectedEmployee.leaveBalances.annual}</strong></div>
                    {selectedEmployee.gender === 'FEMALE' && (
                      <div style={{ ...styles.balancePill, backgroundColor: '#fdf2f8', borderColor: '#fbcfe8', color: '#db2777' }}>
                        Maternity: <strong>{selectedEmployee.leaveBalances.maternity}d</strong>
                      </div>
                    )}
                    {selectedEmployee.gender === 'MALE' && (
                      <div style={{ ...styles.balancePill, backgroundColor: '#eff6ff', borderColor: '#bfdbfe', color: '#2563eb' }}>
                        Paid Paternity: <strong>{selectedEmployee.leaveBalances.paternity}d</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={styles.modalFooter}>
              <button
                style={styles.downloadBtn}
                onClick={() => handleDownloadIndividualReport(selectedEmployee)}
              >
                📥 Download Full Attendance & Payroll Statement (CSV)
              </button>
              <button style={styles.closeModalBtn} onClick={() => setIsModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. ADD NEW BRANCH MODAL */}
      {showAddBranchModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: '500px' }}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Add New Company Campus Branch</h2>
              <button style={styles.closeBtn} onClick={() => setShowAddBranchModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateBranch} style={{ padding: '20px' }}>
              <div style={styles.formGroup}>
                <label style={styles.filterLabel}>Branch / Campus Name *</label>
                <input
                  required
                  style={styles.textInput}
                  placeholder="e.g. Coimbatore Tech Campus"
                  value={newBranchForm.name}
                  onChange={(e) => setNewBranchForm({ ...newBranchForm, name: e.target.value })}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.filterLabel}>Branch Code *</label>
                <input
                  required
                  style={styles.textInput}
                  placeholder="e.g. CBE-04"
                  value={newBranchForm.code}
                  onChange={(e) => setNewBranchForm({ ...newBranchForm, code: e.target.value })}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.filterLabel}>City *</label>
                <input
                  required
                  style={styles.textInput}
                  placeholder="e.g. Coimbatore"
                  value={newBranchForm.city}
                  onChange={(e) => setNewBranchForm({ ...newBranchForm, city: e.target.value })}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.filterLabel}>State *</label>
                <input
                  required
                  style={styles.textInput}
                  placeholder="e.g. Tamil Nadu"
                  value={newBranchForm.state}
                  onChange={(e) => setNewBranchForm({ ...newBranchForm, state: e.target.value })}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.filterLabel}>Full Address *</label>
                <input
                  required
                  style={styles.textInput}
                  placeholder="Campus Address & Landmark"
                  value={newBranchForm.address}
                  onChange={(e) => setNewBranchForm({ ...newBranchForm, address: e.target.value })}
                />
              </div>
              <div style={styles.modalFooter}>
                <button type="submit" style={styles.approveBtn}>Save Branch</button>
                <button type="button" style={styles.closeModalBtn} onClick={() => setShowAddBranchModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Helpers for Status Styles
function getStatusStyle(status: string, isLatePenaltyApplied?: boolean): React.CSSProperties {
  if (isLatePenaltyApplied || status === 'HALF_DAY') {
    return {
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: 'bold',
      backgroundColor: '#fef2f2',
      color: '#dc2626',
      border: '1px solid #fca5a5',
    };
  }
  if (status === 'PRESENT') {
    return {
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: 'bold',
      backgroundColor: '#ecfdf5',
      color: '#059669',
      border: '1px solid #a7f3d0',
    };
  }
  if (status === 'WFH') {
    return {
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: 'bold',
      backgroundColor: '#eff6ff',
      color: '#2563eb',
      border: '1px solid #bfdbfe',
    };
  }
  if (status === 'LEAVE') {
    return {
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: 'bold',
      backgroundColor: '#faf5ff',
      color: '#7c3aed',
      border: '1px solid #ddd6fe',
    };
  }
  return {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    border: '1px solid #e2e8f0',
  };
}

// Inline Styles
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    padding: '24px',
    color: '#0f172a',
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '24px',
  },
  headerTitleGroup: {
    maxWidth: '650px',
  },
  badgeCompany: {
    display: 'inline-block',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '1px',
    color: '#2563eb',
    backgroundColor: '#dbeafe',
    borderRadius: '20px',
    marginBottom: '8px',
  },
  mainTitle: {
    fontSize: '28px',
    fontWeight: '800',
    margin: '0 0 6px 0',
    color: '#0f172a',
  },
  subTitle: {
    margin: 0,
    fontSize: '14px',
    color: '#64748b',
  },
  policyPill: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px 18px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    fontSize: '13px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  policyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  policyLabel: {
    color: '#64748b',
    fontSize: '12px',
  },
  policyValue: {
    color: '#0f172a',
  },
  policyHighlight: {
    color: '#2563eb',
    fontWeight: '600',
  },
  policyWarning: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: '12px',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  kpiCard: {
    backgroundColor: '#ffffff',
    padding: '18px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    border: '1px solid #e2e8f0',
  },
  kpiLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#64748b',
    marginBottom: '6px',
  },
  kpiNumber: {
    fontSize: '26px',
    fontWeight: '800',
    marginBottom: '4px',
    color: '#0f172a',
  },
  kpiMeta: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  navBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '8px',
  },
  navTabs: {
    display: 'flex',
    gap: '8px',
  },
  tabBtn: {
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: '600',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    borderRadius: '8px',
  },
  activeTabBtn: {
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: '700',
    border: 'none',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    cursor: 'pointer',
    borderRadius: '8px',
  },
  addBtn: {
    padding: '8px 16px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  filterBar: {
    backgroundColor: '#ffffff',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    alignItems: 'flex-end',
    marginBottom: '20px',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  filterLabel: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#475569',
  },
  selectInput: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    backgroundColor: '#f8fafc',
    minWidth: '160px',
  },
  textInput: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    backgroundColor: '#f8fafc',
    width: '100%',
    boxSizing: 'border-box',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '12px',
  },
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    overflow: 'hidden',
  },
  tableHeaderSection: {
    padding: '18px 20px',
    borderBottom: '1px solid #e2e8f0',
  },
  tableTitle: {
    margin: '0 0 4px 0',
    fontSize: '18px',
    fontWeight: '700',
  },
  tableSubtitle: {
    fontSize: '13px',
    color: '#64748b',
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px',
  },
  tableHeadRow: {
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  th: {
    padding: '12px 16px',
    fontWeight: '700',
    color: '#475569',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tableRow: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '14px 16px',
    verticalAlign: 'middle',
  },
  empIdBadge: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    backgroundColor: '#f1f5f9',
    padding: '4px 8px',
    borderRadius: '6px',
  },
  empNameBlock: {
    display: 'flex',
    flexDirection: 'column',
  },
  empRoleText: {
    fontSize: '11px',
    color: '#64748b',
  },
  branchBadge: {
    fontSize: '12px',
    color: '#1e293b',
    fontWeight: '500',
  },
  checkTimeBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  lateBadge: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#d97706',
    backgroundColor: '#fef3c7',
    padding: '2px 6px',
    borderRadius: '4px',
    width: 'fit-content',
  },
  penaltyBadge: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    padding: '2px 6px',
    borderRadius: '4px',
    width: 'fit-content',
  },
  activeBadge: {
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: '#dcfce7',
    color: '#15803d',
  },
  inactiveBadge: {
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
  },
  actionButtonGroup: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
  },
  viewDetailBtn: {
    padding: '6px 12px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  downloadBtn: {
    padding: '6px 12px',
    backgroundColor: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  approveBtn: {
    padding: '6px 12px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  rejectBtn: {
    padding: '6px 12px',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  leaveTypeBadge: {
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: '#e0e7ff',
    color: '#4338ca',
  },
  lopBadge: {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    padding: '2px 6px',
    borderRadius: '4px',
    marginTop: '2px',
  },
  certLink: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '12px',
  },
  branchGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  branchCard: {
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  },
  branchHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  branchName: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: '#0f172a',
  },
  branchCode: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
  },
  branchAddress: {
    margin: '0 0 16px 0',
    fontSize: '13px',
    color: '#64748b',
  },
  branchFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid #f1f5f9',
    paddingTop: '12px',
  },
  branchCount: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#334155',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '750px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
  },
  modalHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    margin: '0 0 4px 0',
    fontSize: '20px',
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubHeader: {
    fontSize: '13px',
    color: '#64748b',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#94a3b8',
  },
  modalTabs: {
    display: 'flex',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    padding: '0 16px',
  },
  modalTab: {
    padding: '12px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '13px',
    fontWeight: '600',
    color: '#64748b',
    cursor: 'pointer',
  },
  modalTabActive: {
    padding: '12px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '13px',
    fontWeight: '700',
    color: '#2563eb',
    borderBottom: '2px solid #2563eb',
    cursor: 'pointer',
  },
  modalBody: {
    padding: '24px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  infoLabel: {
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  infoValue: {
    fontSize: '14px',
    color: '#0f172a',
  },
  bankCardBox: {
    backgroundColor: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '20px',
  },
  bankCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '10px',
  },
  bankChip: {
    fontWeight: '700',
    color: '#0f172a',
    fontSize: '14px',
  },
  statsSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    marginBottom: '16px',
  },
  statsBox: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    padding: '12px',
    borderRadius: '8px',
  },
  statsTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748b',
    marginBottom: '4px',
  },
  statsNum: {
    fontSize: '18px',
    fontWeight: '800',
    marginBottom: '2px',
  },
  statsDesc: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  leaveBalanceRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  balancePill: {
    padding: '8px 12px',
    backgroundColor: '#f1f5f9',
    borderRadius: '8px',
    fontSize: '12px',
    border: '1px solid #e2e8f0',
  },
  modalFooter: {
    padding: '16px 24px',
    borderTop: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    display: 'flex',
    justifyContent: 'space-between',
    borderRadius: '0 0 16px 16px',
  },
  closeModalBtn: {
    padding: '8px 18px',
    backgroundColor: '#64748b',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  loadingState: {
    padding: '40px',
    textAlign: 'center',
    color: '#64748b',
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: '#94a3b8',
  },
};

export default HrCeoEmployeePage;
