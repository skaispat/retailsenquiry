"use client";

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  Eye,
  EyeOff,
  Shield,
  User,
  Calendar,
  RefreshCw,
  ChevronDown,
  Briefcase
} from "lucide-react";
import { Select, Modal } from "antd";
import { AuthContext } from "../App";
import { useContext } from "react";
import supabase from "../SupaabseClient";

const { Option } = Select;

const UserManagement = () => {
  const { currentUser, showNotification } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available positions
  const availablePositions = ["MD", "Sales Head", "Area Sales Manager"];

  // Available pages for permissions
  const availablePages = [
    "Dashboard",
    "Dealer Form", 
    "Tracker",
    "History",
    "Reports",
    "Attendance",
    "Attendance History",
    "Daily Report",
    "Admin Logs"
  ];

  const [formData, setFormData] = useState({
    user_name: "",
    sales_person_name: "", // Corrected column name
    password: "",
    role: "user",
    position: "Area Sales Manager",
    access: []
  });

  // Fetch users from master table
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('master')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      showNotification("Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const resetForm = () => {
    setFormData({
      user_name: "",
      sales_person_name: "", // Corrected column name
      password: "",
      role: "user",
      position: "Area Sales Manager",
      access: []
    });
    setEditingUser(null);
    setShowPassword(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePageSelection = (page) => {
    setFormData(prev => {
      const currentPages = prev.access || [];
      if (currentPages.includes(page)) {
        return {
          ...prev,
          access: currentPages.filter(p => p !== page)
        };
      } else {
        return {
          ...prev,
          access: [...currentPages, page]
        };
      }
    });
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      user_name: user.user_name || "",
      sales_person_name: user.sales_person_name || "", // Corrected column name
      password: "", // Don't show existing password
      role: user.role || "user",
      position: user.position || "Area Sales Manager",
      access: user.access ? user.access.split(',').map(p => p.trim()) : []
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Convert page array to comma-separated string
      const accessString = formData.access.join(',');

      if (editingUser) {
        // Update existing user
        const updateData = {
          user_name: formData.user_name,
          sales_person_name: formData.sales_person_name, // Corrected column name
          role: formData.role,
          position: formData.position,
          access: accessString
        };

        // Only update password if provided
        if (formData.password) {
          updateData.password = formData.password;
        }

        const { error } = await supabase
          .from('master')
          .update(updateData)
          .eq('sales_person_name', editingUser.sales_person_name); // Corrected column name

        if (error) throw error;

        showNotification("User updated successfully!", "success");
      } else {
        // Create new user
        const { data, error } = await supabase
          .from('master')
          .insert([{
            user_name: formData.user_name,
            sales_person_name: formData.sales_person_name, // Corrected column name
            password: formData.password,
            role: formData.role,
            position: formData.position,
            access: accessString,
            created_at: new Date().toISOString()
          }])
          .select();

        if (error) {
          if (error.code === '23505') { // Unique violation
            throw new Error("Sales Person Name already exists");
          }
          throw error;
        }

        showNotification("User created successfully!", "success");
      }

      setShowModal(false);
      resetForm();
      fetchUsers(); // Refresh the user list
    } catch (error) {
      console.error("Error saving user:", error);
      showNotification(error.message || "Failed to save user", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    
    try {
      const { error } = await supabase
        .from('master')
        .delete()
        .eq('sales_person_name', userToDelete.sales_person_name); // Corrected column name

      if (error) throw error;

      showNotification("User deleted successfully!", "success");
      setShowDeleteModal(false);
      setUserToDelete(null);
      fetchUsers(); // Refresh the user list
    } catch (error) {
      console.error("Error deleting user:", error);
      showNotification("Failed to delete user", "error");
    }
  };

  const confirmDelete = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  // Filter users based on search, role filter, and position filter
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.sales_person_name?.toLowerCase().includes(searchTerm.toLowerCase()); // Corrected column name
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesPosition = positionFilter === "all" || user.position === positionFilter;
    return matchesSearch && matchesRole && matchesPosition;
  });

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'user': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPositionColor = (position) => {
    switch (position) {
      case 'MD': return 'bg-purple-100 text-purple-800';
      case 'Sales Head': return 'bg-orange-100 text-orange-800';
      case 'Area Sales Manager': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // User Card Component for Mobile View
  const UserCard = ({ user }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">{user.user_name}</h3>
          <p className="text-gray-600 text-sm">{user.sales_person_name}</p> {/* Corrected column name */}
        </div>
        <div className="flex flex-col gap-1 items-end">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
            <Shield className="w-3 h-3 mr-1" />
            {user.role}
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPositionColor(user.position)}`}>
            <Briefcase className="w-3 h-3 mr-1" />
            {user.position}
          </span>
        </div>
      </div>
      
      <div className="mb-3">
        <label className="text-xs font-medium text-gray-500 mb-1 block">Access Pages</label>
        <div className="flex flex-wrap gap-1">
          {user.access ? (
            user.access.split(',').slice(0, 3).map((page, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-800"
              >
                {page.trim()}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-500">No access</span>
          )}
          {user.access && user.access.split(',').length > 3 && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-600">
              +{user.access.split(',').length - 3} more
            </span>
          )}
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Calendar className="w-3 h-3" />
          {new Date(user.created_at).toLocaleDateString()}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEdit(user)}
            className="text-blue-600 hover:text-blue-900 transition-colors p-1"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => confirmDelete(user)}
            className="text-red-600 hover:text-red-900 transition-colors p-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">User Management</h1>
        <p className="text-gray-600">Manage system users and their permissions</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search users..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Role Filter */}
            <div className="w-full sm:w-40">
              <Select
                value={roleFilter}
                onChange={setRoleFilter}
                className="w-full"
                suffixIcon={<Filter className="w-4 h-4" />}
              >
                <Option value="all">All Roles</Option>
                <Option value="admin">Admin</Option>
                <Option value="manager">Manager</Option>
                <Option value="user">User</Option>
              </Select>
            </div>

            {/* Position Filter */}
            <div className="w-full sm:w-40">
              <Select
                value={positionFilter}
                onChange={setPositionFilter}
                className="w-full"
                suffixIcon={<Briefcase className="w-4 h-4" />}
              >
                <Option value="all">All Positions</Option>
                <Option value="MD">MD</Option>
                <Option value="Sales Head">Sales Head</Option>
                <Option value="Area Sales Manager">Area Sales Manager</Option>
              </Select>
            </div>
          </div>

          <div className="flex gap-3">
            {/* Refresh Button */}
            <button
              onClick={fetchUsers}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Add User Button */}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add User</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* Users Table - Desktop & Cards - Mobile */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center p-8">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block">
              <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sales Person Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Access Pages
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
  <tr key={`${user.sales_person_name}-${user.user_name}`} className="hover:bg-gray-50">
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="text-sm font-medium text-gray-900">
        {user.user_name}
      </div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="text-sm text-gray-900 font-semibold">
        {user.sales_person_name}
      </div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
        <Shield className="w-3 h-3 mr-1" />
        {user.role}
      </span>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPositionColor(user.position)}`}>
        <Briefcase className="w-3 h-3 mr-1" />
        {user.position}
      </span>
    </td>
    <td className="px-6 py-4">
      <div className="flex flex-wrap gap-1 max-w-xs">
        {user.access ? (
          user.access.split(',').map((page, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-800"
            >
              {page.trim()}
            </span>
          ))
        ) : (
          <span className="text-xs text-gray-500">No access</span>
        )}
      </div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
      <div className="flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        {new Date(user.created_at).toLocaleDateString()}
      </div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleEdit(user)}
          className="text-blue-600 hover:text-blue-900 transition-colors p-1"
        >
          <Edit className="w-4 h-4" />
        </button>
        <button
          onClick={() => confirmDelete(user)}
          className="text-red-600 hover:text-red-900 transition-colors p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </td>
  </tr>
))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden p-4 max-h-[calc(100vh-280px)] overflow-y-auto">
              {filteredUsers.map((user) => (
                <UserCard key={`${user.sales_person_name}-${user.user_name}`} user={user} /> 
              ))}
            </div>

            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No users found
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit User Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {editingUser ? "Edit User" : "Add New User"}
          </div>
        }
        open={showModal}
        onCancel={() => {
          setShowModal(false);
          resetForm();
        }}
        footer={null}
        width={600}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                name="user_name"
                value={formData.user_name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Sales Person Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sales Person Name *
              </label>
              <input
                type="text"
                name="sales_person_name" 
                value={formData.sales_person_name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={editingUser}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password {editingUser ? "(leave blank to keep current)" : "*"}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                  required={!editingUser}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role *
              </label>
              <Select
                value={formData.role}
                onChange={(value) => handleSelectChange("role", value)}
                className="w-full"
              >
                <Option value="user">User</Option>
                <Option value="manager">Manager</Option>
                <Option value="admin">Admin</Option>
              </Select>
            </div>

            {/* Position */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position *
              </label>
              <Select
                value={formData.position}
                onChange={(value) => handleSelectChange("position", value)}
                className="w-full"
              >
                <Option value="MD">MD</Option>
                <Option value="Sales Head">Sales Head</Option>
                <Option value="Area Sales Manager">Area Sales Manager</Option>
              </Select>
            </div>
          </div>

          {/* Page Access */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Page Access Permissions
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg">
              {availablePages.map((page) => (
                <label key={page} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={formData.access.includes(page)}
                    onChange={() => handlePageSelection(page)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{page}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
              {editingUser ? "Update User" : "Create User"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="Confirm Delete"
        open={showDeleteModal}
        onCancel={() => setShowDeleteModal(false)}
        onOk={handleDelete}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
      >
        <p>
          Are you sure you want to delete user{" "}
          <strong>{userToDelete?.user_name}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default UserManagement;