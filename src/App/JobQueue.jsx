import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "../services/LoggerService.js";

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
      case "GooglePhotosUpload":
        return "Google Photos Upload";
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
      logger.info('JobQueue', 'load_jobs_start', 'Loading job queue data');
      const result = await invoke("get_all_jobs");
      logger.debug('JobQueue', 'raw_result_received', 'Raw result from get_all_jobs', { result });
      
      // Parse the JSON result
      let jobsData;
      try {
        jobsData = JSON.parse(result);
        logger.debug('JobQueue', 'json_parse_success', 'Successfully parsed jobs data', { jobsCount: jobsData?.length });
      } catch (parseError) {
        // If JSON parsing fails, the result might be an error string
        logger.error('JobQueue', 'json_parse_failed', 'Failed to parse jobs data as JSON', { 
          error: parseError.message, 
          rawResult: result 
        });
        setError("Failed to parse jobs data. Raw response: " + result);
        setJobs([]);
        return;
      }
      
      // Handle Rust Result wrapper: {"Ok": [...]} or {"Err": "error message"}
      if (jobsData.Ok && Array.isArray(jobsData.Ok)) {
        logger.info('JobQueue', 'jobs_loaded_success', 'Jobs loaded successfully', { jobsCount: jobsData.Ok.length });
        setJobs(jobsData.Ok);
      } else if (jobsData.Err) {
        logger.error('JobQueue', 'backend_error', 'Backend returned error', { error: jobsData.Err });
        setError(`Backend error: ${jobsData.Err}`);
        setJobs([]);
      } else if (Array.isArray(jobsData)) {
        // Fallback: direct array (in case backend format changes)
        logger.info('JobQueue', 'jobs_loaded_success', 'Jobs loaded successfully', { jobsCount: jobsData.length });
        setJobs(jobsData);
      } else {
        logger.error('JobQueue', 'invalid_data_format', 'Jobs data is not in expected format', { 
          dataType: typeof jobsData, 
          data: jobsData 
        });
        setError(`Invalid jobs data format received. Expected {Ok: array} or array, got ${typeof jobsData}: ${JSON.stringify(jobsData)}`);
        setJobs([]);
      }
    } catch (err) {
      // This catches Tauri command errors
      logger.error('JobQueue', 'tauri_command_failed', 'Tauri get_all_jobs command failed', { error: err.message });
      setError("Failed to load jobs: " + err.message);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const retryJob = async (jobId) => {
    try {
      const result = await invoke("retry_job", { jobId });
      let response;
      try {
        response = JSON.parse(result);
      } catch (parseError) {
        logger.error('JobQueue', 'retry_parse_failed', 'Failed to parse retry response', { error: parseError.message, result });
        props.addFooterMessage("Failed to parse retry response: " + result);
        return;
      }
      
      // Handle Rust Result wrapper: {"Ok": boolean} or {"Err": "error message"}
      if (response.Ok) {
        logger.info('JobQueue', 'job_retry_success', 'Job queued for retry', { jobId });
        props.addFooterMessage("Job queued for retry");
        loadJobs(); // Reload jobs
      } else if (response.Err) {
        logger.error('JobQueue', 'job_retry_failed', 'Failed to retry job', { jobId, error: response.Err });
        props.addFooterMessage(`Failed to retry job: ${response.Err}`);
      } else {
        logger.warn('JobQueue', 'retry_unexpected_format', 'Unexpected retry response format', { response });
        props.addFooterMessage("Failed to retry job: unexpected response format");
      }
    } catch (err) {
      logger.error('JobQueue', 'retry_error', 'Error retrying job', { jobId, error: err.message });
      props.addFooterMessage("Error retrying job: " + err.message);
    }
  };

  const deleteJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to delete this job?")) {
      return;
    }

    try {
      const result = await invoke("delete_job", { jobId });
      let response;
      try {
        response = JSON.parse(result);
      } catch (parseError) {
        logger.error('JobQueue', 'delete_parse_failed', 'Failed to parse delete response', { error: parseError.message, result });
        props.addFooterMessage("Failed to parse delete response: " + result);
        return;
      }
      
      // Handle Rust Result wrapper: {"Ok": boolean} or {"Err": "error message"}
      if (response.Ok) {
        logger.info('JobQueue', 'job_delete_success', 'Job deleted successfully', { jobId });
        props.addFooterMessage("Job deleted successfully");
        loadJobs(); // Reload jobs
      } else if (response.Err) {
        logger.error('JobQueue', 'job_delete_failed', 'Failed to delete job', { jobId, error: response.Err });
        props.addFooterMessage(`Failed to delete job: ${response.Err}`);
      } else {
        logger.warn('JobQueue', 'delete_unexpected_format', 'Unexpected delete response format', { response });
        props.addFooterMessage("Failed to delete job: unexpected response format");
      }
    } catch (err) {
      logger.error('JobQueue', 'delete_error', 'Error deleting job', { jobId, error: err.message });
      props.addFooterMessage("Error deleting job: " + err.message);
    }
  };

  const cleanupCompletedJobs = async () => {
    try {
      const result = await invoke("cleanup_completed_jobs");
      let response;
      try {
        response = JSON.parse(result);
      } catch (parseError) {
        props.addFooterMessage("Failed to parse cleanup response: " + result);
        return;
      }
      
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