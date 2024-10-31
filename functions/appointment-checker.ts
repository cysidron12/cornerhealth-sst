import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Resource } from "sst";

const dynamoDb = DynamoDBDocument.from(new DynamoDBClient({}));
const sqs = new SQSClient({});

interface FormAnswer {
  answer: string;
  label: string;
  id: string;
  displayed_answer: string;
}

interface FormGroup {
  id: string;
  finished: boolean;
  form_answers: FormAnswer[];
}

interface Appointment {
  id: string;
  date: string;
  contact_type: string;
  appointment_type_id: string;
  pm_status: string;
  provider: {
    id: string;
    full_name: string;
    doc_share_id: string;
  };
  form_answer_group?: FormGroup;
  filled_embed_form?: FormGroup;
  user: {
    id: string;
    doc_share_id: string;
    full_name: string;
    has_completed_intake_forms: boolean;
  };
}

export const handler = async () => {
  try {
    const appointments = await fetchUpcomingAppointments();
    console.log(`Found ${appointments.length} appointments in next 24h`);

    const results = {
      total: appointments.length,
      processed: 0,
      remindersSent: 0,
      errors: 0,
      skipped: 0
    };

    for (const appointment of appointments) {
      try {
        results.processed++;

        // Skip appointments without user data
        if (!appointment.user) {
          console.log(`Skipping appointment ${appointment.id} - no user data`);
          results.skipped++;
          continue;
        }

        // Check if we've already sent a reminder
        const existingReminder = await checkExistingReminder(appointment.id);
        if (existingReminder) {
          console.log(`Reminder already sent for appointment ${appointment.id}`);
          results.skipped++;
          continue;
        }

        // Check if intake form is completed
        if (!appointment.user.has_completed_intake_forms) {
          console.log(`Sending reminder for appointment ${appointment.id} - intake forms not completed`);
          
          // Record the reminder in DynamoDB with conversation details
          await saveReminder(appointment.id, "SENT", appointment);
          
          results.remindersSent++;
        } else {
          console.log(`Skipping appointment ${appointment.id} - intake forms completed`);
          results.skipped++;
        }
      } catch (error) {
        console.error(`Error processing appointment ${appointment.id}:`, error);
        results.errors++;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Successfully processed appointments",
        results,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error("Error processing appointments:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error processing appointments",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      })
    };
  }
};

async function fetchUpcomingAppointments(): Promise<Appointment[]> {
  const query = `
    query appointments() {
      appointments(
        is_org: true,
        filter: "upcoming"
      ) {
        id
        date
        contact_type
        length
        location
        provider {
          id
          full_name
        }
        appointment_type {
          name
          id
        }
        user {
          id
          full_name
          has_completed_intake_forms
        }
        provider {
          id
          doc_share_id
        }
      }
    }
  `;

  const response = await fetch(process.env.HEALTHIE_API_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${process.env.HEALTHIE_API_KEY}`,
      'AuthorizationSource': 'API'
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('API Response:', JSON.stringify(data, null, 2));

  if (data.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
  }

  if (!data.data?.appointments) {
    console.log('No appointments found');
    return [];
  }

  // Filter appointments within next 24 hours
  const next24Hours = Date.now() + 24 * 60 * 60 * 1000;
  return data.data.appointments.filter((appointment: Appointment) => {
    const appointmentDate = new Date(appointment.date).getTime();
    return appointmentDate <= next24Hours;
  });
}

async function checkExistingReminder(appointmentId: string): Promise<boolean> {
  const result = await dynamoDb.query({
    TableName: Resource.RemindersTable.name,
    IndexName: "byAppointment",
    KeyConditionExpression: "appointmentId = :appointmentId",
    ExpressionAttributeValues: {
      ":appointmentId": appointmentId,
    },
  });

  return (result.Items?.length ?? 0) > 0;
}

async function sendProviderMessage(appointment: Appointment) {
  console.log('Provider doc_share_id:', appointment.provider.doc_share_id);
  
  const appointmentDate = new Date(appointment.date).toLocaleString();
  const message = `Alert: Patient ${appointment.user.full_name} has not completed their intake forms for the upcoming appointment on ${appointmentDate}.`;

  const mutation = `
    mutation CreateConversation {
      createConversation(input: {
        simple_added_users: "${appointment.provider.doc_share_id}",
        name: "${appointment.user.full_name} - Intake Reminder",
        note: {
          content: "${message}"
          }
      }) {
        conversation {
          id
        }
        messages {
          field
          message
        }
      }
    }
  `;

  console.log('Mutation:', mutation);

  const response = await fetch(Resource.HEALTHIE_URL.value, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Resource.HEALTHIE_API.value}`,
      'AuthorizationSource': 'API'
    },
    body: JSON.stringify({ query: mutation }),
  });

  if (!response.ok) {
    // Send to DLQ if message fails
    await sqs.send(new SendMessageCommand({
      QueueUrl: Resource.FailedApiRequestsQueue.url,
      MessageBody: JSON.stringify({
        type: 'PROVIDER_MESSAGE_FAILED',
        appointmentId: appointment.id,
        error: response.statusText,
        timestamp: new Date().toISOString(),
        patientName: appointment.user.full_name,
        appointmentDate: appointment.date
      }),
    }));
    throw new Error(`Failed to send provider message: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
  }

  return data.data.createConversation.conversation;
}

async function saveReminder(appointmentId: string, status: string, appointment: Appointment) {
  const conversation = await sendProviderMessage(appointment);

  await dynamoDb.put({
    TableName: Resource.RemindersTable.name,
    Item: {
      id: `reminder_${Date.now()}_${appointmentId}`,
      appointmentId,
      status,
      createdAt: Date.now(),
      appointmentDate: appointment.date,
      patientName: appointment.user.full_name,
      conversationId: conversation.id,
      reminderNote: `Alert: Patient ${appointment.user.full_name} has not completed their intake forms for the upcoming appointment on ${new Date(appointment.date).toLocaleString()}.`
    },
  });
} 