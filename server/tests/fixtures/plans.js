// Hand-written stand-ins for what planGenerator.js (Phase 3) will produce.
// Shape matches the plan.js prompt contract: { workflowType, components[],
// fields[] } where each field is { id, componentId, label, question, type,
// options?, requiredIf? }. Used to unit-test the pure core (stateManager,
// planner) without calling the LLM.

// Mirrors the assignment's own example: "notify finance when an invoice
// arrives", with an amount filter and a Slack notification.
export const invoicePlan = {
  workflowType: "invoice_notification",
  components: [
    { id: "trigger", kind: "trigger", label: "Gmail Trigger" },
    { id: "filter", kind: "condition", label: "Amount Check" },
    { id: "notify", kind: "action", label: "Slack Notification" },
  ],
  fields: [
    {
      id: "triggerApp",
      componentId: "trigger",
      label: "Trigger Source",
      question: "Which platform receives the invoice?",
      type: "choice",
      options: ["Gmail", "Outlook"],
      requiredIf: null,
    },
    {
      id: "triggerEvent",
      componentId: "trigger",
      label: "Trigger Event",
      question:
        "Should any new email trigger this, or only ones with attachments?",
      type: "text",
      requiredIf: null,
    },
    {
      id: "hasAmountFilter",
      componentId: "filter",
      label: "Filter By Amount?",
      question: "Should only some invoices trigger this, based on amount?",
      type: "boolean",
      requiredIf: null,
    },
    {
      id: "amountThreshold",
      componentId: "filter",
      label: "Amount Threshold",
      question: "What amount should the filter use?",
      type: "text",
      requiredIf: { field: "hasAmountFilter", equals: true },
    },
    {
      id: "notifyChannel",
      componentId: "notify",
      label: "Notification Channel",
      question: "Which Slack channel or label should be notified?",
      type: "text",
      requiredIf: null,
    },
  ],
};

// A different domain entirely, to prove the planner/stateManager logic is
// generic and doesn't hardcode anything about invoices.
export const cicdPlan = {
  workflowType: "cicd_pipeline",
  components: [
    { id: "trigger", kind: "trigger", label: "Repository Trigger" },
    { id: "build", kind: "action", label: "Build" },
    { id: "test", kind: "condition", label: "Run Tests" },
    { id: "deploy", kind: "action", label: "Deploy" },
    { id: "notify", kind: "action", label: "Notification" },
  ],
  fields: [
    {
      id: "triggerApp",
      componentId: "trigger",
      label: "Repository Host",
      question: "Which repository host triggers the pipeline?",
      type: "text",
      requiredIf: null,
    },
    {
      id: "triggerEvent",
      componentId: "trigger",
      label: "Trigger Branch",
      question: "Which branch or event should trigger a build?",
      type: "text",
      requiredIf: null,
    },
    {
      id: "runTests",
      componentId: "test",
      label: "Run Tests?",
      question: "Should the pipeline run tests before deploying?",
      type: "boolean",
      requiredIf: null,
    },
    {
      id: "testCommand",
      componentId: "test",
      label: "Test Command",
      question: "What command runs the tests?",
      type: "text",
      requiredIf: { field: "runTests", equals: true },
    },
    {
      id: "deployTarget",
      componentId: "deploy",
      label: "Deploy Target",
      question: "Where should the app deploy to?",
      type: "text",
      requiredIf: null,
    },
    {
      id: "requiresApproval",
      componentId: "deploy",
      label: "Manual Approval?",
      question: "Does deployment need manual approval?",
      type: "boolean",
      requiredIf: null,
    },
    {
      id: "notifyChannel",
      componentId: "notify",
      label: "Notification Channel",
      question: "Where should build/deploy notifications go?",
      type: "text",
      requiredIf: null,
    },
  ],
};
