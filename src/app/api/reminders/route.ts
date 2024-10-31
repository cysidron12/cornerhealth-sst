import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const dynamoDb = DynamoDBDocument.from(new DynamoDBClient({}));

export async function GET() {
  try {
    // Fetch sent reminders from DynamoDB
    const sentResult = await dynamoDb.query({
      TableName: Resource.RemindersTable.name,
      IndexName: "byStatus",
      KeyConditionExpression: "#s = :status",
      ExpressionAttributeNames: {
        "#s": "status"
      },
      ExpressionAttributeValues: {
        ":status": "SENT",
      },
      ScanIndexForward: false, // Get most recent first
      Limit: 50, // Limit to last 50 reminders
    });

    // Fetch failed reminders from DynamoDB
    const failedResult = await dynamoDb.query({
      TableName: Resource.RemindersTable.name,
      IndexName: "byStatus",
      KeyConditionExpression: "#s = :status",
      ExpressionAttributeNames: {
        "#s": "status"
      },
      ExpressionAttributeValues: {
        ":status": "FAILED",
      },
      ScanIndexForward: false,
      Limit: 50,
    });

    // Map the sent reminders to match the UI's expected format
    const sentReminders = sentResult.Items?.map(item => ({
      id: item.id,
      createdAt: item.createdAt,
      displayName: item.patientName,
      archived: false,
      viewed: true,
      provider: {
        id: 'system',
        full_name: 'System',
        role: 'system'
      },
      message: item.reminderNote || '',
      notes: [{
        id: item.id,
        content: item.reminderNote || '',
        created_at: new Date(item.createdAt).toISOString(),
        creator: {
          id: 'system',
          full_name: 'System'
        }
      }],
      patientName: item.patientName,
      appointmentDate: item.appointmentDate
    })) || [];

    return Response.json({
      success: true,
      sent: sentReminders,
      failed: failedResult.Items,
    });
  } catch (error) {
    console.error('Failed to fetch reminders:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch reminders"
    }, { status: 500 });
  }
} 