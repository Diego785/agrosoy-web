import type { Metadata } from "next";
import { LoginForm } from "@/modules/identity/presentation/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/presentation/ui/card";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Agrosoy</CardTitle>
          <CardDescription>Ventas, cobranzas e inventario</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
