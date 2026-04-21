import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Separator } from "@/components/ui/separator";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Payslip() {
  const { user } = useAuth();

  // Mock computed salary data
  const baseSalary = 45000;
  const allowances = 5000;
  const grossPay = baseSalary + allowances;
  
  const tax = grossPay * 0.12;
  const philHealth = 1200;
  const sss = 1800;
  const pagIbig = 400;
  
  const totalDeductions = tax + philHealth + sss + pagIbig;
  const netPay = grossPay - totalDeductions;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">My Payslip</h2>
          <p className="text-gray-500">Current pay period: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" /> Download PDF
        </Button>
      </div>

      <Card className="border-gray-200">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg text-gray-900">Los Banos Doctors Hospital</h3>
              <p className="text-sm text-gray-500">Salary Slip</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-900">{user?.name}</p>
              <p className="text-sm text-gray-500 uppercase">{user?.role}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Earnings
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Base Salary</span>
                  <span className="font-medium">₱{baseSalary.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Allowances</span>
                  <span className="font-medium">₱{allowances.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Gross Pay</span>
                  <span className="text-gray-900">₱{grossPay.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500"></span> Deductions
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Withholding Tax</span>
                  <span className="font-medium text-red-600">-₱{tax.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">SSS Contribution</span>
                  <span className="font-medium text-red-600">-₱{sss.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">PhilHealth</span>
                  <span className="font-medium text-red-600">-₱{philHealth.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pag-IBIG</span>
                  <span className="font-medium text-red-600">-₱{pagIbig.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Total Deductions</span>
                  <span className="text-red-600">-₱{totalDeductions.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-primary/5 border-t border-primary/10 flex justify-between items-center py-4">
          <span className="font-semibold text-primary">Net Take Home Pay</span>
          <span className="text-2xl font-bold text-primary">₱{netPay.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
        </CardFooter>
      </Card>
    </div>
  );
}
