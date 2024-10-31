import { Resource } from "sst";

export async function POST() {
  try {
    if (!Resource.AppointmentChecker.url) {
      throw new Error("Lambda URL not found");
    }

    console.log("Invoking lambda at URL:", Resource.AppointmentChecker.url);

    const response = await fetch(Resource.AppointmentChecker.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("Lambda response not OK:", {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`Lambda invocation failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("Lambda result:", result);

    return Response.json({ 
      status: "success", 
      message: "Lambda invoked successfully",
      result
    });
  } catch (error) {
    console.error("Failed to invoke lambda:", error);
    return Response.json({ 
      status: "error", 
      message: error instanceof Error ? error.message : "Unknown error",
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 