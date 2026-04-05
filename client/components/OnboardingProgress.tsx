import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

export function OnboardingProgress({
  currentStep,
  totalSteps,
  steps,
}: OnboardingProgressProps) {
  return (
    <div className="w-full">
      {/* Step Indicators */}
      <div className="flex justify-between items-center mb-8">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <React.Fragment key={index}>
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all",
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isCurrent
                        ? "bg-blue-500 text-white ring-4 ring-blue-200"
                        : "bg-gray-200 text-gray-600"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{stepNumber}</span>
                  )}
                </div>
                <p
                  className={cn(
                    "mt-2 text-sm font-medium text-center max-w-[100px]",
                    isCompleted || isCurrent ? "text-gray-900" : "text-gray-600"
                  )}
                >
                  {step}
                </p>
              </div>

              {/* Connector Line */}
              {stepNumber < totalSteps && (
                <div
                  className={cn(
                    "flex-1 h-1 mx-2 my-0 rounded transition-all",
                    isCompleted ? "bg-green-500" : "bg-gray-200"
                  )}
                  style={{ minHeight: "4px" }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{
            width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%`,
          }}
        />
      </div>

      {/* Step Counter */}
      <p className="text-center text-sm text-gray-600">
        Step {currentStep} of {totalSteps}
      </p>
    </div>
  );
}
