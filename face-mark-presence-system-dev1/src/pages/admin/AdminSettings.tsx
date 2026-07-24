import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AttendancePolicy,
  createDepartment,
  createDocumentType,
  createEmploymentType,
  deleteDepartment,
  deleteDocumentType,
  deleteEmploymentType,
  Department,
  DocumentType,
  EmploymentType,
  getAttendancePolicies,
  getDepartments,
  getDocumentTypes,
  getEmploymentTypes,
  updateDepartment,
  updateDocumentType,
  updateEmploymentType,
  updateAttendancePolicyForType,
} from "@/services/settingsService";
import { toast } from "sonner";

const AdminSettings = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [policies, setPolicies] = useState<AttendancePolicy[]>([]);
  const [savingPolicyId, setSavingPolicyId] = useState<string | null>(null);

  const [newDept, setNewDept] = useState({ name: "", code: "", description: "" });
  const [newEmpType, setNewEmpType] = useState({ name: "", code: "" });
  const [newDocType, setNewDocType] = useState({ key: "", label: "", isRequired: false });

  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editDept, setEditDept] = useState({ name: "", code: "", description: "", isActive: true });
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editEmp, setEditEmp] = useState({ name: "", code: "", sortOrder: 0, isActive: true });
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editDoc, setEditDoc] = useState({ key: "", label: "", isRequired: false, sortOrder: 0, isActive: true });
  const [savingEdit, setSavingEdit] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [d, e, doc, p] = await Promise.all([
      getDepartments(false),
      getEmploymentTypes(),
      getDocumentTypes(),
      getAttendancePolicies(),
    ]);
    setDepartments(d);
    setEmploymentTypes(e);
    setDocumentTypes(doc);
    setPolicies(p);
  }, []);

  useEffect(() => {
    loadAll().catch(() => toast.error("Failed to load settings"));
  }, [loadAll]);

  const handleAddDepartment = async () => {
    if (!newDept.name || !newDept.code) return toast.error("Name and code required");
    try {
      await createDepartment({ ...newDept, isActive: true });
      setNewDept({ name: "", code: "", description: "" });
      await loadAll();
      toast.success("Department added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleAddEmploymentType = async () => {
    if (!newEmpType.name || !newEmpType.code) return toast.error("Name and code required");
    try {
      await createEmploymentType({
        name: newEmpType.name,
        code: newEmpType.code,
        isActive: true,
        sortOrder: employmentTypes.length + 1,
      });
      setNewEmpType({ name: "", code: "" });
      await loadAll();
      toast.success("Employment type added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleAddDocumentType = async () => {
    if (!newDocType.key || !newDocType.label) return toast.error("Key and label required");
    try {
      await createDocumentType({
        key: newDocType.key,
        label: newDocType.label,
        isRequired: newDocType.isRequired,
        isActive: true,
        sortOrder: documentTypes.length + 1,
      });
      setNewDocType({ key: "", label: "", isRequired: false });
      await loadAll();
      toast.success("Document type added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const startEditDepartment = (d: Department) => {
    setEditingDeptId(d.id);
    setEditDept({
      name: d.name,
      code: d.code,
      description: d.description || "",
      isActive: d.isActive,
    });
  };

  const saveDepartment = async () => {
    if (!editingDeptId || !editDept.name || !editDept.code) {
      return toast.error("Name and code required");
    }
    setSavingEdit(`dept-${editingDeptId}`);
    try {
      await updateDepartment(editingDeptId, {
        name: editDept.name,
        code: editDept.code,
        description: editDept.description || undefined,
        isActive: editDept.isActive,
      });
      setEditingDeptId(null);
      await loadAll();
      toast.success("Department updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSavingEdit(null);
    }
  };

  const startEditEmployment = (et: EmploymentType) => {
    setEditingEmpId(et.id);
    setEditEmp({
      name: et.name,
      code: et.code,
      sortOrder: et.sortOrder,
      isActive: et.isActive,
    });
  };

  const saveEmployment = async () => {
    if (!editingEmpId || !editEmp.name || !editEmp.code) {
      return toast.error("Name and code required");
    }
    setSavingEdit(`emp-${editingEmpId}`);
    try {
      await updateEmploymentType(editingEmpId, {
        name: editEmp.name,
        code: editEmp.code,
        sortOrder: editEmp.sortOrder,
        isActive: editEmp.isActive,
      });
      setEditingEmpId(null);
      await loadAll();
      toast.success("Employment type updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSavingEdit(null);
    }
  };

  const startEditDocument = (dt: DocumentType) => {
    setEditingDocId(dt.id);
    setEditDoc({
      key: dt.key,
      label: dt.label,
      isRequired: dt.isRequired,
      sortOrder: dt.sortOrder,
      isActive: dt.isActive,
    });
  };

  const saveDocument = async () => {
    if (!editingDocId || !editDoc.key || !editDoc.label) {
      return toast.error("Key and label required");
    }
    setSavingEdit(`doc-${editingDocId}`);
    try {
      await updateDocumentType(editingDocId, {
        key: editDoc.key,
        label: editDoc.label,
        isRequired: editDoc.isRequired,
        sortOrder: editDoc.sortOrder,
        isActive: editDoc.isActive,
      });
      setEditingDocId(null);
      await loadAll();
      toast.success("Document type updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSavingEdit(null);
    }
  };

  const updatePolicyField = (employmentTypeId: string, field: keyof AttendancePolicy, value: string | number) => {
    setPolicies((prev) =>
      prev.map((p) => (p.employmentTypeId === employmentTypeId ? { ...p, [field]: value } : p))
    );
  };

  const savePolicy = async (policy: AttendancePolicy) => {
    if (!policy.employmentTypeId) return;
    setSavingPolicyId(policy.employmentTypeId);
    try {
      const updated = await updateAttendancePolicyForType(policy.employmentTypeId, policy);
      setPolicies((prev) =>
        prev.map((p) => (p.employmentTypeId === policy.employmentTypeId ? updated : p))
      );
      toast.success(`${policy.employmentTypeName} attendance policy saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save policy");
    } finally {
      setSavingPolicyId(null);
    }
  };

  return (
    <div className="container px-4 py-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">System Settings</h1>

        <Tabs defaultValue="departments">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="employment">Employment</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
          </TabsList>

          <TabsContent value="departments" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Departments</CardTitle>
                <CardDescription>Manage organizational departments for employees.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Name" value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })} />
                  <Input placeholder="Code" value={newDept.code} onChange={(e) => setNewDept({ ...newDept, code: e.target.value.toUpperCase() })} />
                  <Button onClick={handleAddDepartment} className="attendance-gradient">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {departments.map((d) => (
                    <div key={d.id} className="border rounded p-3 space-y-3">
                      {editingDeptId === d.id ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Name"
                              value={editDept.name}
                              onChange={(e) => setEditDept({ ...editDept, name: e.target.value })}
                            />
                            <Input
                              placeholder="Code"
                              value={editDept.code}
                              onChange={(e) => setEditDept({ ...editDept, code: e.target.value.toUpperCase() })}
                            />
                            <Input
                              className="col-span-2"
                              placeholder="Description"
                              value={editDept.description}
                              onChange={(e) => setEditDept({ ...editDept, description: e.target.value })}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editDept.isActive}
                              onCheckedChange={(v) => setEditDept({ ...editDept, isActive: v })}
                            />
                            <Label className="text-sm">Active</Label>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => setEditingDeptId(null)}>
                              <X className="h-4 w-4 mr-1" /> Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="attendance-gradient"
                              disabled={savingEdit === `dept-${d.id}`}
                              onClick={saveDepartment}
                            >
                              {savingEdit === `dept-${d.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-1" /> Save
                                </>
                              )}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{d.name}</span>
                            <Badge variant="outline" className="ml-2">{d.code}</Badge>
                            {d.description && (
                              <p className="text-xs text-muted-foreground mt-1">{d.description}</p>
                            )}
                            {!d.isActive && <Badge className="ml-2" variant="secondary">Inactive</Badge>}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => startEditDepartment(d)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {d.isActive && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  deleteDepartment(d.id)
                                    .then(loadAll)
                                    .then(() => toast.success("Department deactivated"))
                                }
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employment" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Employment Types</CardTitle>
                <CardDescription>Configurable options when onboarding employees.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Name (e.g. Full-time)" value={newEmpType.name} onChange={(e) => setNewEmpType({ ...newEmpType, name: e.target.value })} />
                  <Input placeholder="Code" value={newEmpType.code} onChange={(e) => setNewEmpType({ ...newEmpType, code: e.target.value })} />
                  <Button onClick={handleAddEmploymentType} className="attendance-gradient">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                {employmentTypes.map((et) => (
                  <div key={et.id} className="border rounded p-3 space-y-3">
                    {editingEmpId === et.id ? (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            placeholder="Name"
                            value={editEmp.name}
                            onChange={(e) => setEditEmp({ ...editEmp, name: e.target.value })}
                          />
                          <Input
                            placeholder="Code"
                            value={editEmp.code}
                            onChange={(e) => setEditEmp({ ...editEmp, code: e.target.value })}
                          />
                          <Input
                            type="number"
                            min={0}
                            placeholder="Sort order"
                            value={editEmp.sortOrder}
                            onChange={(e) => setEditEmp({ ...editEmp, sortOrder: Number(e.target.value) })}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={editEmp.isActive}
                            onCheckedChange={(v) => setEditEmp({ ...editEmp, isActive: v })}
                          />
                          <Label className="text-sm">Active</Label>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => setEditingEmpId(null)}>
                            <X className="h-4 w-4 mr-1" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="attendance-gradient"
                            disabled={savingEdit === `emp-${et.id}`}
                            onClick={saveEmployment}
                          >
                            {savingEdit === `emp-${et.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-1" /> Save
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span>
                          {et.name} <Badge variant="outline" className="ml-2">{et.code}</Badge>
                          {!et.isActive && <Badge className="ml-2" variant="secondary">Inactive</Badge>}
                        </span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => startEditEmployment(et)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {et.isActive && (
                            <Button variant="ghost" size="sm" onClick={() => deleteEmploymentType(et.id).then(loadAll)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Document Types</CardTitle>
                <CardDescription>HR documents required during employee onboarding.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 gap-2 items-end">
                  <Input placeholder="Key (aadhaar)" value={newDocType.key} onChange={(e) => setNewDocType({ ...newDocType, key: e.target.value })} />
                  <Input placeholder="Label" value={newDocType.label} onChange={(e) => setNewDocType({ ...newDocType, label: e.target.value })} />
                  <div className="flex items-center gap-2">
                    <Switch checked={newDocType.isRequired} onCheckedChange={(v) => setNewDocType({ ...newDocType, isRequired: v })} />
                    <Label className="text-sm">Required</Label>
                  </div>
                  <Button onClick={handleAddDocumentType} className="attendance-gradient">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                {documentTypes.map((dt) => (
                  <div key={dt.id} className="border rounded p-3 space-y-3">
                    {editingDocId === dt.id ? (
                      <>
                        <div className="grid grid-cols-3 gap-2 items-end">
                          <Input
                            placeholder="Key"
                            value={editDoc.key}
                            onChange={(e) => setEditDoc({ ...editDoc, key: e.target.value })}
                          />
                          <Input
                            placeholder="Label"
                            value={editDoc.label}
                            onChange={(e) => setEditDoc({ ...editDoc, label: e.target.value })}
                          />
                          <Input
                            type="number"
                            min={0}
                            placeholder="Sort order"
                            value={editDoc.sortOrder}
                            onChange={(e) => setEditDoc({ ...editDoc, sortOrder: Number(e.target.value) })}
                          />
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editDoc.isRequired}
                              onCheckedChange={(v) => setEditDoc({ ...editDoc, isRequired: v })}
                            />
                            <Label className="text-sm">Required</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editDoc.isActive}
                              onCheckedChange={(v) => setEditDoc({ ...editDoc, isActive: v })}
                            />
                            <Label className="text-sm">Active</Label>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => setEditingDocId(null)}>
                            <X className="h-4 w-4 mr-1" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="attendance-gradient"
                            disabled={savingEdit === `doc-${dt.id}`}
                            onClick={saveDocument}
                          >
                            {savingEdit === `doc-${dt.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-1" /> Save
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span>
                          {dt.label}
                          {dt.isRequired && <Badge className="ml-2">Required</Badge>}
                          <Badge variant="outline" className="ml-2">{dt.key}</Badge>
                          {!dt.isActive && <Badge className="ml-2" variant="secondary">Inactive</Badge>}
                        </span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => startEditDocument(dt)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {dt.isActive && (
                            <Button variant="ghost" size="sm" onClick={() => deleteDocumentType(dt.id).then(loadAll)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily Attendance Thresholds</CardTitle>
                <CardDescription>
                  Configure shift timings and rules per employment type (present, late, half-day, overtime).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {policies.length === 0 ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  policies.map((policy) => (
                    <div key={policy.employmentTypeId} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{policy.employmentTypeName}</h3>
                        <Badge variant="outline">{policy.employmentTypeCode}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Shift Start</Label>
                          <Input
                            type="time"
                            value={policy.shiftStartTime}
                            onChange={(e) =>
                              updatePolicyField(policy.employmentTypeId!, "shiftStartTime", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Shift End</Label>
                          <Input
                            type="time"
                            value={policy.shiftEndTime}
                            onChange={(e) =>
                              updatePolicyField(policy.employmentTypeId!, "shiftEndTime", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Late Grace (minutes)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={policy.lateGraceMinutes}
                            onChange={(e) =>
                              updatePolicyField(policy.employmentTypeId!, "lateGraceMinutes", Number(e.target.value))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Half Day Threshold (hours)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={policy.halfDayHours}
                            onChange={(e) =>
                              updatePolicyField(policy.employmentTypeId!, "halfDayHours", Number(e.target.value))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Full Day Threshold (hours)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={policy.fullDayHours}
                            onChange={(e) =>
                              updatePolicyField(policy.employmentTypeId!, "fullDayHours", Number(e.target.value))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Overtime After (hours)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={policy.overtimeAfterHours}
                            onChange={(e) =>
                              updatePolicyField(policy.employmentTypeId!, "overtimeAfterHours", Number(e.target.value))
                            }
                          />
                        </div>
                      </div>
                      <Button
                        onClick={() => savePolicy(policy)}
                        disabled={savingPolicyId === policy.employmentTypeId}
                        className="attendance-gradient"
                      >
                        {savingPolicyId === policy.employmentTypeId ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save {policy.employmentTypeName} Policy
                      </Button>
                    </div>
                  ))
                )}
                <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                  <li>Late: check-in after shift start + grace period</li>
                  <li>Half day: worked less than half-day threshold hours</li>
                  <li>Present: worked at or above full-day threshold</li>
                  <li>Early departure: checkout before shift end with insufficient hours</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  );
};

export default AdminSettings;
