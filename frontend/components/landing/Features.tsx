"use client";

import { Users, Clock, DollarSign, FileText, CheckSquare, File } from "lucide-react";

const features = [
  {
    title: "Attendance Tracking",
    description: "Automated time tracking with biometric support and real-time reports",
    icon: Clock,
  },
  {
    title: "Leave Management",
    description: "Simple leave requests, approvals, and balance tracking for all employees",
    icon: Users,
  },
  {
    title: "Payroll Processing",
    description: "Automated salary calculations with tax deductions and compliance",
    icon: DollarSign,
  },
  {
    title: "Payslip Generation",
    description: "Beautiful PDF payslips with your company branding and footer text",
    icon: FileText,
  },
  {
    title: "Onboarding",
    description: "Streamlined onboarding workflow with task templates and checklists",
    icon: CheckSquare,
  },
  {
    title: "Document Storage",
    description: "Secure document storage for employee contracts and important files",
    icon: File,
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-background relative">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Everything you need for <br className="hidden md:block" />
            <span className="text-primary">HR Management</span>
          </h2>
          <p className="text-xl text-foreground/70">
            A complete HR platform designed specifically for agencies and consultancies
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-8 rounded-2xl bg-background border border-border hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <feature.icon className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-foreground/70 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
