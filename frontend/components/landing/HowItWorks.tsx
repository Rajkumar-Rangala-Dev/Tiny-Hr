"use client";

import { ArrowRight, UserPlus, CheckCircle2, Award } from "lucide-react";

const steps = [
  {
    title: "Create your workspace",
    description: "Sign up and configure your organization with your brand colors",
    icon: UserPlus,
  },
  {
    title: "Add employees",
    description: "Invite your team and set up their profiles with complete HR data",
    icon: CheckCircle2,
  },
  {
    title: "Start managing",
    description: "Track attendance, process payroll, and manage leaves with ease",
    icon: Award,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            How <span className="text-primary">Tiny HR</span> Works
          </h2>
          <p className="text-xl text-foreground/70">
            Get up and running in minutes, not days
          </p>
        </div>

        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-primary/20 transform -translate-x-1/2 hidden md:block"></div>

          <div className="space-y-16 md:space-y-24">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex flex-col md:flex-row items-center gap-12 ${
                  index % 2 === 1 ? "md:flex-row-reverse" : ""
                }`}
              >
                {/* Content */}
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg mb-6">
                    {index + 1}
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                  <p className="text-lg text-foreground/70 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Icon */}
                <div className="flex-shrink-0 relative">
                  <div className="w-32 h-32 rounded-2xl bg-background border-2 border-primary/20 flex items-center justify-center relative z-10">
                    <step.icon className="h-16 w-16 text-primary" />
                  </div>
                  <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl -z-0 transform translate-x-4 translate-y-4"></div>
                </div>

                {/* Mobile line */}
                <div className="md:hidden absolute left-1/2 top-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent -z-10"></div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-16">
          <div className="inline-block px-6 py-3 bg-primary/10 rounded-full text-primary font-medium">
            Ready to get started?{" "}
            <a href="/register" className="inline-flex items-center gap-2 hover:underline">
              Create your workspace <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
