import React, { useEffect, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createEmployee,
  CreateEmployeePayload,
  Employee,
  EmployeeDocument,
  getEmployee,
  updateEmployee,
  UpdateEmployeePayload,
  uploadEmployeeDocument,
} from "@/services/employeeService";
import { getDepartments } from "@/services/employeeService";
import {
  Department,
  DocumentType,
  EmploymentType,
  getDocumentTypes,
  getEmploymentTypes,
} from "@/services/settingsService";
import { toast } from "sonner";

const defaultSalary = {
  basicSalary: 25000,
  hra: 10000,
  da: 5000,
  conveyance: 1600,
  medicalAllowance: 1250,
  specialAllowance: 7150,
  overtimeRate: 200,
};

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onCreated?: (employee: Employee) => void;
  employee?: Employee | null;
}

const AddEmployeeDialog: React.FC<AddEmployeeDialogProps> = ({
  open,
  onOpenChange,
  onSaved,
  onCreated,
  employee,
}) => {
  const isEdit = Boolean(employee?.userId);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);

  const [form, setForm] = useState({
    userName: "",
    email: "",
    password: "",
    phone: "",
    departmentId: "",
    joiningDate: new Date().toISOString().slice(0, 10),
    terminationDate: "",
    designation: "",
    employmentType: "Full-time",
    status: "Active",
    aadhaarNumber: "",
    panNumber: "",
    uanNumber: "",
    esiNumber: "",
    bankAccountNumber: "",
    bankIfsc: "",
    bankName: "",
    ...defaultSalary,
  });

  useEffect(() => {
    if (!open) return;

    const loadConfig = Promise.all([getDepartments(), getEmploymentTypes(), getDocumentTypes()])
      .then(([depts, empTypes, docTypes]) => {
        setDepartments(depts);
        const activeEmp = empTypes.filter((e) => e.isActive);
        setEmploymentTypes(activeEmp);
        setDocumentTypes(docTypes.filter((d) => d.isActive));
        return activeEmp;
      });

    if (isEdit && employee?.userId) {
      setIsFetching(true);
      Promise.all([loadConfig, getEmployee(employee.userId)])
        .then(([, full]) => {
          const salary = full.salary ?? defaultSalary;
          setForm({
            userName: full.userName || "",
            email: full.email || "",
            password: "",
            phone: full.phone || "",
            departmentId: full.departmentId || "",
            joiningDate: full.joiningDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            terminationDate: full.terminationDate?.slice(0, 10) || "",
            designation: full.designation || "",
            employmentType: full.employmentType || "Full-time",
            status: full.status || "Active",
            aadhaarNumber: full.aadhaarNumber || "",
            panNumber: full.panNumber || "",
            uanNumber: full.uanNumber || "",
            esiNumber: full.esiNumber || "",
            bankAccountNumber: full.bankAccountNumber || "",
            bankIfsc: full.bankIfsc || "",
            bankName: full.bankName || "",
            basicSalary: salary.basicSalary ?? defaultSalary.basicSalary,
            hra: salary.hra ?? defaultSalary.hra,
            da: salary.da ?? defaultSalary.da,
            conveyance: salary.conveyance ?? defaultSalary.conveyance,
            medicalAllowance: salary.medicalAllowance ?? defaultSalary.medicalAllowance,
            specialAllowance: salary.specialAllowance ?? defaultSalary.specialAllowance,
            overtimeRate: salary.overtimeRate ?? defaultSalary.overtimeRate,
          });
          const existingDocs = Object.entries(full.documents || {}).map(([type, doc]) => ({
            type,
            name: doc.name,
            url: doc.url,
          }));
          setDocuments(existingDocs);
        })
        .catch(() => toast.error("Could not load employee details"))
        .finally(() => setIsFetching(false));
    } else {
      loadConfig
        .then((activeEmp) => {
          if (activeEmp.length) {
            setForm((prev) => ({ ...prev, employmentType: activeEmp[0].name }));
          }
        })
        .catch(() => toast.error("Could not load HRMS configuration"));
    }
  }, [open, isEdit, employee?.userId]);

  const update = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDocumentUpload = async (type: string, file: File) => {
    setUploadingDoc(type);
    try {
      const url = await uploadEmployeeDocument(file);
      setDocuments((prev) => [
        ...prev.filter((d) => d.type !== type),
        { type, name: file.name, url },
      ]);
      toast.success(`${file.name} uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingDoc(null);
    }
  };

  const resetForm = () => {
    setForm({
      userName: "",
      email: "",
      password: "",
      phone: "",
      departmentId: "",
      joiningDate: new Date().toISOString().slice(0, 10),
      terminationDate: "",
      designation: "",
      employmentType: "Full-time",
      status: "Active",
      aadhaarNumber: "",
      panNumber: "",
      uanNumber: "",
      esiNumber: "",
      bankAccountNumber: "",
      bankIfsc: "",
      bankName: "",
      ...defaultSalary,
    });
    setDocuments([]);
  };

  const handleSubmit = async () => {
    if (!form.userName.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!isEdit && !form.password.trim()) {
      toast.error("Password is required for new employees");
      return;
    }
    if (form.password && form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (!isEdit) {
      const missingRequired = documentTypes
        .filter((d) => d.isRequired)
        .filter((d) => !documents.some((doc) => doc.type === d.key));
      if (missingRequired.length > 0) {
        toast.error(`Upload required documents: ${missingRequired.map((d) => d.label).join(", ")}`);
        return;
      }
    }

    setIsLoading(true);
    try {
      const salary = {
        basicSalary: Number(form.basicSalary),
        hra: Number(form.hra),
        da: Number(form.da),
        conveyance: Number(form.conveyance),
        medicalAllowance: Number(form.medicalAllowance),
        specialAllowance: Number(form.specialAllowance),
        overtimeRate: Number(form.overtimeRate),
        effectiveFrom: form.joiningDate,
      };

      if (isEdit && employee?.userId) {
        const payload: UpdateEmployeePayload = {
          userName: form.userName.trim(),
          email: form.email.trim(),
          phone: form.phone || undefined,
          departmentId: form.departmentId || undefined,
          joiningDate: form.joiningDate || undefined,
          terminationDate: form.terminationDate || undefined,
          designation: form.designation || undefined,
          employmentType: form.employmentType,
          status: form.status,
          aadhaarNumber: form.aadhaarNumber || undefined,
          panNumber: form.panNumber || undefined,
          uanNumber: form.uanNumber || undefined,
          esiNumber: form.esiNumber || undefined,
          bankAccountNumber: form.bankAccountNumber || undefined,
          bankIfsc: form.bankIfsc || undefined,
          bankName: form.bankName || undefined,
          documents,
          salary,
        };
        if (form.password.trim()) {
          payload.password = form.password;
        }
        await updateEmployee(employee.userId, payload);
        toast.success(`Employee ${form.userName} updated successfully`);
      } else {
        const payload: CreateEmployeePayload = {
          userName: form.userName.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone || undefined,
          departmentId: form.departmentId || undefined,
          joiningDate: form.joiningDate || undefined,
          terminationDate: form.terminationDate || undefined,
          designation: form.designation || undefined,
          employmentType: form.employmentType,
          status: form.status,
          aadhaarNumber: form.aadhaarNumber || undefined,
          panNumber: form.panNumber || undefined,
          uanNumber: form.uanNumber || undefined,
          esiNumber: form.esiNumber || undefined,
          bankAccountNumber: form.bankAccountNumber || undefined,
          bankIfsc: form.bankIfsc || undefined,
          bankName: form.bankName || undefined,
          documents,
          salary,
        };
        const created = await createEmployee(payload);
        toast.success(`Employee ${form.userName} created successfully`);
        onCreated?.(created);
      }

      resetForm();
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${isEdit ? "update" : "create"} employee`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Employee" : "Add New Employee"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update HRMS profile, payroll, bank details, and documents."
              : "Complete HRMS profile including payroll, leave setup, and documents."}
          </DialogDescription>
        </DialogHeader>

        {isFetching ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="hrms">HRMS</TabsTrigger>
            <TabsTrigger value="bank">Bank</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="documents">Docs</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="userName">Full Name *</Label>
                <Input
                  id="userName"
                  value={form.userName}
                  onChange={(e) => update("userName", e.target.value)}
                  placeholder="John Employee"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="employee@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{isEdit ? "New Password" : "Password *"}</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder={isEdit ? "Leave blank to keep current" : "Min 6 characters"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="9876543210"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="hrms" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employee Code</Label>
                {isEdit ? (
                  <Input value={employee?.employeeCode || "—"} readOnly disabled className="bg-muted" />
                ) : (
                  <p className="text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted/50">
                    Auto-generated 6-digit code on save
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={form.departmentId}
                  onValueChange={(v) => update("departmentId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Joining Date</Label>
                <Input
                  type="date"
                  value={form.joiningDate}
                  onChange={(e) => update("joiningDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Termination Date</Label>
                <Input
                  type="date"
                  value={form.terminationDate}
                  onChange={(e) => update("terminationDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input
                  value={form.designation}
                  onChange={(e) => update("designation", e.target.value)}
                  placeholder="e.g. Software Engineer"
                />
              </div>
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <Select
                  value={form.employmentType}
                  onValueChange={(v) => update("employmentType", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {employmentTypes.map((et) => (
                      <SelectItem key={et.id} value={et.name}>
                        {et.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => update("status", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="On Leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Aadhaar Number</Label>
                <Input
                  value={form.aadhaarNumber}
                  onChange={(e) => update("aadhaarNumber", e.target.value)}
                  placeholder="12-digit Aadhaar"
                  maxLength={12}
                />
              </div>
              <div className="space-y-2">
                <Label>PAN Number</Label>
                <Input
                  value={form.panNumber}
                  onChange={(e) => update("panNumber", e.target.value)}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label>UAN Number</Label>
                <Input
                  value={form.uanNumber}
                  onChange={(e) => update("uanNumber", e.target.value)}
                  placeholder="PF UAN"
                />
              </div>
              <div className="space-y-2">
                <Label>ESI Number</Label>
                <Input
                  value={form.esiNumber}
                  onChange={(e) => update("esiNumber", e.target.value)}
                  placeholder="ESI number"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave balances (SL, CL, EL, UL) are auto-created for the current year.
            </p>
          </TabsContent>

          <TabsContent value="bank" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Bank Name</Label>
                <Input
                  value={form.bankName}
                  onChange={(e) => update("bankName", e.target.value)}
                  placeholder="State Bank of India"
                />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  value={form.bankAccountNumber}
                  onChange={(e) => update("bankAccountNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>IFSC Code</Label>
                <Input
                  value={form.bankIfsc}
                  onChange={(e) => update("bankIfsc", e.target.value.toUpperCase())}
                  placeholder="SBIN0001234"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="payroll" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ["basicSalary", "Basic Salary"],
                  ["hra", "HRA"],
                  ["da", "DA"],
                  ["conveyance", "Conveyance"],
                  ["medicalAllowance", "Medical Allowance"],
                  ["specialAllowance", "Special Allowance"],
                  ["overtimeRate", "Overtime Rate (/hr)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form[key]}
                    onChange={(e) => update(key, Number(e.target.value))}
                  />
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Monthly gross: ₹
              {(
                Number(form.basicSalary) +
                Number(form.hra) +
                Number(form.da) +
                Number(form.conveyance) +
                Number(form.medicalAllowance) +
                Number(form.specialAllowance)
              ).toLocaleString("en-IN")}
            </p>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-4">
            {documentTypes.map(({ key, label, isRequired }) => {
              const uploaded = documents.find((d) => d.type === key);
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 border rounded-lg p-3"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {label}
                      {isRequired && <span className="text-destructive ml-1">*</span>}
                    </p>
                    {uploaded ? (
                      <p className="text-xs text-green-600 truncate max-w-xs">
                        {uploaded.name}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not uploaded</p>
                    )}
                  </div>
                  <label>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleDocumentUpload(key, file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingDoc === key}
                      asChild
                    >
                      <span>
                        {uploadingDoc === key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-1" />
                            {uploaded ? "Replace" : "Upload"}
                          </>
                        )}
                      </span>
                    </Button>
                  </label>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              {isEdit
                ? "Replacing a document uploads a new file and updates the record."
                : "After creation, use the Face button on the employees list to enroll face and set profile photo."}
            </p>
          </TabsContent>
        </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading || isFetching}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || isFetching} className="attendance-gradient">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEdit ? "Saving…" : "Creating…"}
              </>
            ) : (
              isEdit ? "Save Changes" : "Create Employee"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddEmployeeDialog;
