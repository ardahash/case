import { Badge } from "@/components/ui/badge";

export type StepStatus = "pending" | "active" | "done";

interface Step {
  label: string;
  status: StepStatus;
}

interface StepperProps {
  steps: Step[];
}

export function Stepper({ steps }: StepperProps) {
  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center gap-3">
          <Badge
            variant={step.status === "done" ? "default" : step.status === "active" ? "secondary" : "muted"}
          >
            {index + 1}
          </Badge>
          <span className={step.status === "pending" ? "text-muted-foreground" : "text-foreground"}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

