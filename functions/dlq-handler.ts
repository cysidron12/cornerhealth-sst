import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

const dynamoDb = DynamoDBDocument.from(new DynamoDBClient({}));

export const handler = async (event: any) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    
    // Log the failed message to DynamoDB
    await dynamoDb.put({
      TableName: process.env.REMINDERS_TABLE!,
      Item: {
        id: `failed_${Date.now()}_${message.appointmentId}`,
        appointmentId: message.appointmentId,
        status: 'FAILED',
        createdAt: Date.now(),
        error: message.error,
      },
    });
  }
}; 