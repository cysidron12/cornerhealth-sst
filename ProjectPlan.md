## Tasks

1. **Check for upcoming appointments** scheduled within the next 24 hours.

2. **Verify** for each appointment whether or not the patient has completed their intake form.

3. **Send a message** to the provider of the appointment if the intake form has **not** been completed.

## System Design

- Building with SST serverless framework
- Core business logic should live in a lambda function
  - Business logic involves integrating with the Healthie GraphQL API - details available below
- Use CRON schedules to trigger the lambda
- For API retry/failures, use a dead letter queue
- Use typescript everywhere
- Handle cases where appointments are rescheduled or canceled last minute- use your judgement here on the best approach
- Define all SST components needed in the sst.config.ts file, this should include at least a CRON job, a lambda function, a queue for failed API requests, and a DynamoDB table for storing sent and failed reminders (partition key is Failed#ReminderID or Sent#ReminderId)

## Implementation Plan

- [ ] Define all SST components needed in the sst.config.ts file
- [ ] Create a lambda function that will check for upcoming appointments and send reminders to providers
- [ ] Create a dead letter queue for failed API requests
- [ ] Create a DynamoDB table for storing sent and failed reminders
- [ ] Create a CRON job that will trigger the lambda function

## Healthie GraphQL API

To save time, we’ve pointed out some GraphQL objects + mutations you’ll need to access:

- To access appointments: [You can query the Appointment and it’s related objects for all needed information here.](https://docs.gethealthie.com/docs/#deleteappointment-mutation)
  - mutation deleteAppointment($id: ID, $deleteRecurring: Boolean) {
    deleteAppointment(input: { id: $id, deleteRecurring: $deleteRecurring }) {
    appointment {
    id
    }
    messages {
    field
    message
    }
    }
    }
- To determine if intake is completed: On the Appointment object you can query the [**User** object](https://docs.gethealthie.com/schema/user.doc) (which corresponds to the patient’s User), where there is a boolean field `has_completed_intake_forms` that is `true` if the patient HAS completed their intake.
- To send a message to provider, you can use the [createConversation GraphQL mutation](https://docs.gethealthie.com/docs/#conversation-memberships) and include use the provider’s User’s [doc_share_id](https://docs.gethealthie.com/schema/user.doc) in the `simple_added_users` array parameter of the mutation. Note that the object returned via `appointment { provider { ... } }` is also a `User` object, i.e. both providers and patients have `User` objects in Healthie with all of the respective queryable fields.
  - {
    "conversationMembership": {
    "convo": {
    "id": "12345",
    "viewed": false, # has unread messages
    "notes": [
    {
    "user_id": "123451",
    "content": "<p>Hey</p>"
    },
    {
    "user_id": "123451",
    "content": "<p>Example message</p>"
    }
    ]
    }
    }
    }

## Other notes

- The graphql URL for healthie API as well as the API key are available in the .env file
