"use client";

import React, { useState, useEffect } from "react";

interface SentReminder {
  id: string;
  createdAt: number;
  displayName: string;
  archived: boolean;
  viewed: boolean;
  provider: {
    id: string;
    full_name: string;
    role: string;
  };
  message: string;
  notes: Array<{
    id: string;
    content: string;
    created_at: string;
    creator?: {
      id: string;
      full_name: string;
    };
  }>;
  patientName: string;
  appointmentDate: string;
}

interface FailedReminder {
  id: string;
  appointmentId: string;
  status: string;
  createdAt: number;
  error?: string;
  patientName: string;
  appointmentDate: string;
}

interface CheckResult {
  status: "success" | "error";
  message: string;
  results?: {
    total: number;
    processed: number;
    remindersSent: number;
    errors: number;
    skipped: number;
  };
  timestamp?: string;
  error?: string;
  details?: string;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [sentReminders, setSentReminders] = useState<SentReminder[]>([]);
  const [failedReminders, setFailedReminders] = useState<FailedReminder[]>([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(true);
  const [expandedNotes, setExpandedNotes] = useState<string[]>([]);

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    setIsLoadingReminders(true);
    try {
      const response = await fetch("/api/reminders");
      const data = await response.json();
      if (data.success) {
        setSentReminders(data.sent || []);
        setFailedReminders(data.failed || []);
      }
    } catch (error) {
      console.error("Failed to fetch reminders:", error);
    } finally {
      setIsLoadingReminders(false);
    }
  };

  const checkAppointments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/check-appointments", {
        method: "POST",
      });
      const data = await response.json();
      setResult(data);
      // Refresh reminders after checking appointments
      await fetchReminders();
    } catch (error) {
      setResult({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to check appointments",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const EmptyState = ({ message }: { message: string }) => (
    <tr>
      <td colSpan={5} className="px-6 py-12">
        <div className="text-center">
          <div className="text-gray-400 mb-2">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">{message}</p>
        </div>
      </td>
    </tr>
  );

  const toggleNotes = (reminderId: string) => {
    setExpandedNotes((prev) =>
      prev.includes(reminderId)
        ? prev.filter((id) => id !== reminderId)
        : [...prev, reminderId]
    );
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">
          Appointment Checker Dashboard
        </h1>

        <div className="grid gap-8">
          {/* Action Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col items-start gap-6">
              <div>
                <button
                  onClick={checkAppointments}
                  disabled={isLoading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                           disabled:bg-blue-300 transition-colors duration-200 font-medium"
                >
                  {isLoading
                    ? "Checking Appointments..."
                    : "Check Appointments Now"}
                </button>
              </div>

              {result && (
                <div className="w-full">
                  <h2 className="text-lg font-semibold mb-2 text-gray-700">
                    {result.status === "success" ? "Results" : "Error"}
                  </h2>
                  <div
                    className={`rounded-md p-4 font-mono text-sm whitespace-pre-wrap
                                ${
                                  result.status === "success"
                                    ? "bg-green-50 text-green-800"
                                    : "bg-red-50 text-red-800"
                                }`}
                  >
                    {JSON.stringify(result, null, 2)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reminders Tables */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Sent Reminders */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Sent Reminders
              </h2>
              {isLoadingReminders ? (
                <p>Loading...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date Sent
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Provider
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Patient Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Appointment Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sentReminders.length === 0 ? (
                        <EmptyState message="No reminders have been sent yet" />
                      ) : (
                        sentReminders.map((reminder) => (
                          <React.Fragment key={reminder.id}>
                            <tr>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(reminder.createdAt)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {reminder.provider.full_name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                {reminder.patientName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {reminder.appointmentDate}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {reminder.notes.length > 0 && (
                                  <button
                                    onClick={() => toggleNotes(reminder.id)}
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    {expandedNotes.includes(reminder.id)
                                      ? "Hide"
                                      : "Show"}{" "}
                                    Notes ({reminder.notes.length})
                                  </button>
                                )}
                              </td>
                            </tr>
                            {expandedNotes.includes(reminder.id) &&
                              reminder.notes.length > 0 && (
                                <tr>
                                  <td
                                    colSpan={5}
                                    className="px-6 py-4 bg-gray-50"
                                  >
                                    <div className="space-y-4">
                                      {reminder.notes.map((note) => (
                                        <div key={note.id} className="text-sm">
                                          <div className="flex justify-between text-gray-600 mb-1">
                                            <span>
                                              {note.creator?.full_name ||
                                                "Unknown"}
                                            </span>
                                            <span>
                                              {new Date(
                                                note.created_at
                                              ).toLocaleString()}
                                            </span>
                                          </div>
                                          <div
                                            className="text-gray-800 bg-white p-3 rounded border"
                                            dangerouslySetInnerHTML={{
                                              __html: note.content,
                                            }}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Failed Reminders */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Failed Reminders
              </h2>
              {isLoadingReminders ? (
                <p>Loading...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date Failed
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Patient Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Appointment Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Appointment ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Error
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {failedReminders.length === 0 ? (
                        <EmptyState message="No failed reminders found - everything is working correctly!" />
                      ) : (
                        failedReminders.map((reminder) => (
                          <tr key={reminder.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(reminder.createdAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                              {reminder.patientName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {reminder.appointmentDate}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {reminder.appointmentId}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500">
                              {reminder.error}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
