import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

const JobQueue = (props) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getJobTypeName = (jobType) => {
    switch (jobType) {
      case "Import":
        return "Import";
      case "Thumbnail":
        return "Thumbnail";
      case "CreateDb":
        return "Create DB";
      default:
        return jobType;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "#ffa500";
      case "running":
        return "#0066cc";
      case "completed":
        return "#008000";
      case "failed":
        return "#cc0000";
      default:
        return "#666666";
    }
  };

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke("get_all_jobs");
      const jobsData = JSON.parse(result);
      setJobs(jobsData);
    } catch (err) {
      setError("Failed to load jobs: " + err.message);
      console.error("Error loading jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  const retryJob = async (jobId) => {
    try {
      const result = await invoke("retry_job", { jobId });
      const response = JSON.parse(result);
      if (response.result) {
        props.addFooterMessage("Job queued for retry");
        loadJobs(); // Reload jobs
      } else {
        props.addFooterMessage("Failed to retry job");
      }
    } catch (err) {
      props.addFooterMessage("Error retrying job: " + err.message);
    }
  };

  const deleteJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to delete this job?")) {
      return;
    }

    try {
      const result = await invoke("delete_job", { jobId });
      const response = JSON.parse(result);
      if (response.result) {
        props.addFooterMessage("Job deleted successfully");
        loadJobs(); // Reload jobs
      } else {
        props.addFooterMessage("Failed to delete job");
      }
    } catch (err) {
      props.addFooterMessage("Error deleting job: " + err.message);
    }
  };

  const cleanupCompletedJobs = async () => {
    try {
      const result = await invoke("cleanup_completed_jobs");
      const response = JSON.parse(result);
      if (response.result) {
        props.addFooterMessage("Completed jobs cleaned up");
        loadJobs(); // Reload jobs
      } else {
        props.addFooterMessage("Failed to cleanup completed jobs");
      }
    } catch (err) {
      props.addFooterMessage("Error cleaning up jobs: " + err.message);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  return (
    <div className="job-queue">
      <div className="job-queue-header">
        <h2>Job Queue Management</h2>
        <div className="job-queue-actions">
          <button onClick={loadJobs} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button onClick={cleanupCompletedJobs} disabled={loading}>
            Cleanup Completed
          </button>
          <button onClick={() => props.toggleJobQueue(false)}>
            Close
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="job-queue-content">
        {loading ? (
          <div className="loading">Loading jobs...</div>
        ) : (
          <div className="job-table-container">
            <table className="job-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Job Unit ID</th>
                  <th>Job Type</th>
                  <th>Target Count</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Error Message</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: "center", padding: "20px" }}>
                      No jobs in queue
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id}>
                      <td>{job.id}</td>
                      <td title={job.job_unit_id}>
                        {job.job_unit_id.substring(0, 8)}...
                      </td>
                      <td>{getJobTypeName(job.job.job_type)}</td>
                      <td>{job.job.target.length}</td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ 
                            backgroundColor: getStatusColor(job.status),
                            color: "white",
                            padding: "2px 6px",
                            borderRadius: "3px",
                            fontSize: "0.8em"
                          }}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td>{formatDateTime(job.created_at)}</td>
                      <td>{formatDateTime(job.started_at)}</td>
                      <td>{formatDateTime(job.completed_at)}</td>
                      <td title={job.error_message || ""}>
                        {job.error_message ? (
                          <span className="error-text">
                            {job.error_message.length > 30 
                              ? job.error_message.substring(0, 30) + "..."
                              : job.error_message}
                          </span>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td>
                        <div className="job-actions">
                          {job.status === "failed" && (
                            <button
                              onClick={() => retryJob(job.id)}
                              className="retry-button"
                              title="Retry job"
                            >
                              Retry
                            </button>
                          )}
                          {(job.status === "pending" || job.status === "failed") && (
                            <button
                              onClick={() => deleteJob(job.id)}
                              className="delete-button"
                              title="Delete job"
                            >
                              Delete
                            </button>
                          )}
                        </div>
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
  );
};

export default JobQueue;