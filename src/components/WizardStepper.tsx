import React from 'react';

interface Step {
  id: string;
  label: string;
  completed: boolean;
  hasError: boolean;
}

interface WizardStepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

function StepCircle({
  index,
  step,
  isCurrent,
  onClick,
}: {
  index: number;
  step: Step;
  isCurrent: boolean;
  onClick?: () => void;
}) {
  const isClickable = !!onClick && (step.completed || isCurrent);

  let circleClass =
    'relative flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-all duration-200 select-none shrink-0 ';
  let icon: React.ReactNode = <span>{index + 1}</span>;

  if (step.hasError) {
    circleClass += 'bg-red-500 text-white shadow-md';
    icon = (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
      </svg>
    );
  } else if (step.completed) {
    circleClass += 'bg-green-500 text-white shadow-md';
    icon = (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
      </svg>
    );
  } else if (isCurrent) {
    circleClass += 'bg-blue-600 text-white shadow-lg ring-4 ring-blue-100';
  } else {
    circleClass += 'bg-gray-200 text-gray-500';
  }

  if (isClickable) circleClass += ' cursor-pointer hover:opacity-90';
  else circleClass += ' cursor-default';

  const pulse = isCurrent && !step.hasError && !step.completed;

  return (
    <button
      type="button"
      className={circleClass}
      onClick={isClickable ? onClick : undefined}
      aria-label={`Step ${index + 1}: ${step.label}`}
      aria-current={isCurrent ? 'step' : undefined}
    >
      {pulse && (
        <span className="absolute inset-0 rounded-full animate-ping bg-blue-400 opacity-30" />
      )}
      {icon}
    </button>
  );
}

const WizardStepper: React.FC<WizardStepperProps> = ({ steps, currentStep, onStepClick }) => {
  return (
    <>
      {/* Horizontal layout (md+) */}
      <nav aria-label="Form steps" className="hidden md:block">
        <ol className="flex items-start w-full">
          {steps.map((step, index) => {
            const isCurrent = index === currentStep;
            const isLast = index === steps.length - 1;

            return (
              <li key={step.id} className={`flex items-start ${isLast ? 'flex-none' : 'flex-1'}`}>
                <div className="flex flex-col items-center">
                  <StepCircle
                    index={index}
                    step={step}
                    isCurrent={isCurrent}
                    onClick={onStepClick ? () => onStepClick(index) : undefined}
                  />
                  <span
                    className={[
                      'mt-2 text-xs font-medium text-center max-w-[80px] leading-tight',
                      step.hasError
                        ? 'text-red-600'
                        : isCurrent
                        ? 'text-blue-700'
                        : step.completed
                        ? 'text-green-700'
                        : 'text-gray-400',
                    ].join(' ')}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div className="flex-1 mt-4 mx-2">
                    <div
                      className={[
                        'h-0.5 w-full rounded transition-colors duration-300',
                        step.completed ? 'bg-green-400' : 'bg-gray-200',
                      ].join(' ')}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Vertical layout (mobile) */}
      <nav aria-label="Form steps" className="md:hidden">
        <ol className="flex flex-col gap-0">
          {steps.map((step, index) => {
            const isCurrent = index === currentStep;
            const isLast = index === steps.length - 1;

            return (
              <li key={step.id} className="flex items-stretch gap-3">
                {/* Left column: circle + connector */}
                <div className="flex flex-col items-center">
                  <StepCircle
                    index={index}
                    step={step}
                    isCurrent={isCurrent}
                    onClick={onStepClick ? () => onStepClick(index) : undefined}
                  />
                  {!isLast && (
                    <div
                      className={[
                        'w-0.5 flex-1 my-1 rounded transition-colors duration-300',
                        step.completed ? 'bg-green-400' : 'bg-gray-200',
                      ].join(' ')}
                    />
                  )}
                </div>

                {/* Right column: label */}
                <div className={`flex items-center pb-${isLast ? '0' : '4'}`}>
                  <span
                    className={[
                      'text-sm font-medium leading-snug',
                      step.hasError
                        ? 'text-red-600'
                        : isCurrent
                        ? 'text-blue-700'
                        : step.completed
                        ? 'text-green-700'
                        : 'text-gray-400',
                    ].join(' ')}
                  >
                    {step.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
};

export default WizardStepper;

