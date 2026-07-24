import React, { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyPayslips, type PayrollEmployeeRow } from "@/services/payrollService";
import { resolveMediaUrl } from "@/lib/api";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const formatINR = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
};

const Payslips = () => {
  const [rows, setRows] = useState<PayrollEmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyPayslips()
      .then(setRows)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load payslips"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="container px-4 py-8 flex-1 max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-1">Payslips</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your salary slips after payroll is calculated or approved.
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-attendance-primary" />
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No payslips yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <Card key={r.id || `${r.month}-${r.year}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">
                    {r.month && r.year
                      ? `${MONTHS[(r.month || 1) - 1]} ${r.year}`
                      : "Payslip"}
                  </CardTitle>
                  <Badge variant="outline" className="capitalize">
                    {(r.status || "").replace(/_/g, " ")}
                  </Badge>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xl font-semibold">{formatINR(r.netPay)}</div>
                    <div className="text-xs text-muted-foreground">
                      Gross {formatINR(r.grossEarnings)} · Deductions {formatINR(r.totalDeductions)}
                    </div>
                  </div>
                  {r.payslipUrl ? (
                    <Button variant="outline" asChild>
                      <a href={resolveMediaUrl(r.payslipUrl)} target="_blank" rel="noreferrer">
                        <FileText className="h-4 w-4 mr-1" /> PDF
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">PDF after approval</span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Payslips;
