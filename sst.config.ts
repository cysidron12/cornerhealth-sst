/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "cornerhealth-sst",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    // Add Secrets for environment variables
    const healthieApi = new sst.Secret("HEALTHIE_API");
    const healthieUrl = new sst.Secret("HEALTHIE_URL");
    
    // DynamoDB table for appointment reminders
    const remindersTable = new sst.aws.Dynamo("RemindersTable", {
      fields: {
        id: "string",
        appointmentId: "string",
        status: "string",
        createdAt: "number",
        appointmentDate: "string",
        patientName: "string",
        error: "string",
        conversationId: "string",
        reminderNote: "string",
      },
      primaryIndex: { hashKey: "id" },
      globalIndexes: {
        byStatus: { 
          hashKey: "status", 
          rangeKey: "createdAt",
          projection: "all"
        },
        byAppointment: { 
          hashKey: "appointmentId",
          rangeKey: "createdAt",
          projection: "all"
        },
        byPatient: { 
          hashKey: "patientName", 
          rangeKey: "appointmentDate",
          projection: "all"
        },
        byErrorType: {
          hashKey: "error",
          rangeKey: "reminderNote",
          projection: "all"
        },
        byConversation: {
          hashKey: "conversationId",
          rangeKey: "createdAt",
          projection: "all"
        }
      },
    });

    // Dead Letter Queue for failed API requests
    const dlq = new sst.aws.Queue("FailedApiRequestsQueue");
    dlq.subscribe("functions/dlq-handler.handler");

    // Main Lambda function for business logic
    const appointmentChecker = new sst.aws.Function("AppointmentChecker", {
      handler: "functions/appointment-checker.handler",
      environment: {
        HEALTHIE_API_URL: healthieUrl.value,
        HEALTHIE_API_KEY: healthieApi.value,
      },
      link: [remindersTable, dlq, healthieApi, healthieUrl],
      url: true,
    });

    // CRON scheduler to run every hour
    new sst.aws.Cron("HourlyAppointmentCheck", {
      schedule: "rate(1 hour)",
      job: {
        handler: "functions/appointment-checker.handler",
        link: [remindersTable, dlq, healthieApi, healthieUrl],
        environment: {
          HEALTHIE_API_URL: healthieUrl.value,
          HEALTHIE_API_KEY: healthieApi.value,
        }
      }
    });

    new sst.aws.Nextjs("MyWeb", {
      link: [appointmentChecker, healthieApi, healthieUrl, remindersTable],
    });
  },
});
