import React, { useCallback, useEffect, useState } from "react";
import AddEmployeeDialog from "@/components/admin/AddEmployeeDialog";
import FaceEnrollmentDialog from "@/components/admin/FaceEnrollmentDialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Pencil, ScanFace } from "lucide-react";
import { getUsers } from "@/services/userService";
import { Employee } from "@/services/employeeService";
import { resolveMediaUrl } from "@/lib/api";

const Users = () => {
  const [users, setUsers] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [faceEnrollEmployee, setFaceEnrollEmployee] = useState<Employee | null>(null);

  const openFaceEnroll = (employee: Employee) => {
    setFaceEnrollEmployee(employee);
  };

  const openCreate = () => {
    setEditingEmployee(null);
    setDialogOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingEmployee(null);
  };

  const loadUsers = useCallback(async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = users.filter((user) => {
    const q = search.toLowerCase();
    return (
      user.userName?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.employeeCode?.toLowerCase().includes(q) ||
      user.departmentName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="container px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Employee Management</h1>
          <Button onClick={openCreate} className="attendance-gradient">
            <UserPlus className="mr-2 h-4 w-4" />
            Add New Employee
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Employees ({filtered.length})</CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 mt-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, code, department…"
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Joining</TableHead>
                  <TableHead>Payroll</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {user.userImage ? (
                            <img
                              src={resolveMediaUrl(user.userImage)}
                              alt={user.userName}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">
                              {user.userName?.charAt(0)}
                            </div>
                          )}
                          {user.userName}
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.employeeCode || "—"}</TableCell>
                      <TableCell>{user.departmentName || "—"}</TableCell>
                      <TableCell>
                        {user.joiningDate
                          ? new Date(user.joiningDate).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {user.hasSalaryStructure ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            Configured
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            user.status === "Active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-600"
                          }
                        >
                          {user.status || "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openFaceEnroll(user)}>
                            <ScanFace className="h-4 w-4 mr-1" />
                            Face
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      <AddEmployeeDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        onSaved={loadUsers}
        onCreated={(employee) => setFaceEnrollEmployee(employee)}
        employee={editingEmployee}
      />

      {faceEnrollEmployee && (
        <FaceEnrollmentDialog
          open={!!faceEnrollEmployee}
          onOpenChange={(open) => !open && setFaceEnrollEmployee(null)}
          userId={faceEnrollEmployee.userId}
          userName={faceEnrollEmployee.userName}
          onComplete={loadUsers}
        />
      )}
    </div>
  );
};

export default Users;
