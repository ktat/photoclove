import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "../services/LoggerService.js";
import './JobQueue.css';

const JobQueue = ({ onClose, ...props }) => {
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
      case "RecalculateGrouping":
        return "Recalculate Grouping";
      case "AiTagging":
        return "AI Tagging";
      case "S3Sync":
        return "S3 Sync";
      case "FaceDetection":
        return "Face Detection";
      case "FaceThumbnailRegenerate":
        return "Face Thumbnail Regenerate";
      default:
        // Handle snake_case format from Rust serialization
        return jobType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "var(--color-status-pending)";
      case "running":
        return "var(--color-status-running)";
      case "completed":
        return "var(--color-status-success)";
      case "failed":
        return "var(--color-status-error)";
      default:
        return "var(--color-status-default)";
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
        props.addFooterMessage("job_queue", "Failed to parse retry response: " + result);
        return;
      }

      // Handle Rust Result wrapper: {"Ok": boolean} or {"Err": "error message"}
      if (response.Ok) {
        logger.info('JobQueue', 'job_retry_success', 'Job queued for retry', { jobId });
        props.addFooterMessage("job_queue", "Job queued for retry");
        loadJobs(); // Reload jobs
      } else if (response.Err) {
        logger.error('JobQueue', 'job_retry_failed', 'Failed to retry job', { jobId, error: response.Err });
        props.addFooterMessage("job_queue", `Failed to retry job: ${response.Err}`);
      } else {
        logger.warn('JobQueue', 'retry_unexpected_format', 'Unexpected retry response format', { response });
        props.addFooterMessage("job_queue", "Failed to retry job: unexpected response format");
      }
    } catch (err) {
      logger.error('JobQueue', 'retry_error', 'Error retrying job', { jobId, error: err.message });
      props.addFooterMessage("job_queue", "Error retrying job: " + err.message);
    }
  };

  const resumeJob = async (jobId) => {
    try {
      const result = await invoke("resume_job", { jobId });
      let response;
      try {
        response = JSON.parse(result);
      } catch (parseError) {
        logger.error('JobQueue', 'resume_parse_failed', 'Failed to parse resume response', { error: parseError.message, result });
        props.addFooterMessage("job_queue", "Failed to parse resume response: " + result);
        return;
      }

      if (response.Ok) {
        logger.info('JobQueue', 'job_resume_success', 'Job resumed', { jobId });
        props.addFooterMessage("job_queue", "Job resumed from last position");
        loadJobs();
      } else if (response.Err) {
        logger.error('JobQueue', 'job_resume_failed', 'Failed to resume job', { jobId, error: response.Err });
        props.addFooterMessage("job_queue", `Failed to resume job: ${response.Err}`);
      }
    } catch (err) {
      logger.error('JobQueue', 'resume_error', 'Error resuming job', { jobId, error: err.message });
      props.addFooterMessage("job_queue", "Error resuming job: " + err.message);
    }
  };

  const restartJob = async (jobId) => {
    if (!window.confirm("This will restart the job from the beginning. Continue?")) {
      return;
    }

    try {
      const result = await invoke("restart_job", { jobId });
      let response;
      try {
        response = JSON.parse(result);
      } catch (parseError) {
        logger.error('JobQueue', 'restart_parse_failed', 'Failed to parse restart response', { error: parseError.message, result });
        props.addFooterMessage("job_queue", "Failed to parse restart response: " + result);
        return;
      }

      if (response.Ok) {
        logger.info('JobQueue', 'job_restart_success', 'Job restarted', { jobId });
        props.addFooterMessage("job_queue", "Job restarted from beginning");
        loadJobs();
      } else if (response.Err) {
        logger.error('JobQueue', 'job_restart_failed', 'Failed to restart job', { jobId, error: response.Err });
        props.addFooterMessage("job_queue", `Failed to restart job: ${response.Err}`);
      }
    } catch (err) {
      logger.error('JobQueue', 'restart_error', 'Error restarting job', { jobId, error: err.message });
      props.addFooterMessage("job_queue", "Error restarting job: " + err.message);
    }
  };

  const stopJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to stop this running job?")) {
      return;
    }

    try {
      const result = await invoke("stop_job", { jobId });
      let response;
      try {
        response = JSON.parse(result);
      } catch (parseError) {
        logger.error('JobQueue', 'stop_parse_failed', 'Failed to parse stop response', { error: parseError.message, result });
        props.addFooterMessage("job_queue", "Failed to parse stop response: " + result);
        return;
      }

      if (response.Ok) {
        logger.info('JobQueue', 'job_stop_success', 'Job stop requested', { jobId });
        props.addFooterMessage("job_queue", "Job stop requested. It will stop after current item.");
        // Refresh after a short delay to show updated status
        setTimeout(loadJobs, 1000);
      } else if (response.Err) {
        logger.error('JobQueue', 'job_stop_failed', 'Failed to stop job', { jobId, error: response.Err });
        props.addFooterMessage("job_queue", `Failed to stop job: ${response.Err}`);
      }
    } catch (err) {
      logger.error('JobQueue', 'stop_error', 'Error stopping job', { jobId, error: err.message });
      props.addFooterMessage("job_queue", "Error stopping job: " + err.message);
    }
  };

  // Check if a job has partial progress (for Resume/Restart UI)
  const hasProgress = (job) => {
    return job.processed_count > 0 && job.processed_count < job.job.target.length;
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
        props.addFooterMessage("job_queue", "Failed to parse delete response: " + result);
        return;
      }
      
      // Handle Rust Result wrapper: {"Ok": boolean} or {"Err": "error message"}
      if (response.Ok) {
        logger.info('JobQueue', 'job_delete_success', 'Job deleted successfully', { jobId });
        props.addFooterMessage("job_queue", "Job deleted successfully");
        loadJobs(); // Reload jobs
      } else if (response.Err) {
        logger.error('JobQueue', 'job_delete_failed', 'Failed to delete job', { jobId, error: response.Err });
        props.addFooterMessage("job_queue", `Failed to delete job: ${response.Err}`);
      } else {
        logger.warn('JobQueue', 'delete_unexpected_format', 'Unexpected delete response format', { response });
        props.addFooterMessage("job_queue", "Failed to delete job: unexpected response format");
      }
    } catch (err) {
      logger.error('JobQueue', 'delete_error', 'Error deleting job', { jobId, error: err.message });
      props.addFooterMessage("job_queue", "Error deleting job: " + err.message);
    }
  };

  const cleanupCompletedJobs = async () => {
    try {
      const result = await invoke("cleanup_completed_jobs");
      let response;
      try {
        response = JSON.parse(result);
      } catch (parseError) {
        props.addFooterMessage("job_queue", "Failed to parse cleanup response: " + result);
        return;
      }
      
      if (response.result) {
        props.addFooterMessage("job_queue", "Completed jobs cleaned up");
        loadJobs(); // Reload jobs
      } else {
        props.addFooterMessage("job_queue", "Failed to cleanup completed jobs");
      }
    } catch (err) {
      props.addFooterMessage("job_queue", "Error cleaning up jobs: " + err.message);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  return (
    <div className="job-queue-overlay">
      <div className="job-queue">
        <div className="job-queue-header">
          <div className="job-queue-title-section">
            <h2>Job Queue Management</h2>
          </div>
          <div className="job-queue-actions">
            <button onClick={loadJobs} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
            <button onClick={cleanupCompletedJobs} disabled={loading}>
              Cleanup Completed
            </button>
            <button onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {error && (
          <div className="job-queue-error">
            <strong>Error:</strong> {error}
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
                    <th>Progress</th>
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
                        <td>
                          {job.status === "running" || job.status === "completed"
                            ? `${job.processed_count}/${job.job.target.length}`
                            : job.job.target.length}
                        </td>
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
                            {(job.status === "pending" || job.status === "failed") && (
                              hasProgress(job) ? (
                                <>
                                  <button
                                    onClick={() => resumeJob(job.id)}
                                    className="resume-button"
                                    title="Resume from last position"
                                  >
                                    Resume
                                  </button>
                                  <button
                                    onClick={() => restartJob(job.id)}
                                    className="restart-button"
                                    title="Restart from beginning"
                                  >
                                    Restart
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => retryJob(job.id)}
                                  className="retry-button"
                                  title={job.status === "pending" ? "Start job" : "Retry job"}
                                >
                                  {job.status === "pending" ? "Start" : "Retry"}
                                </button>
                              )
                            )}
                            {job.status === "running" && (
                              <button
                                onClick={() => stopJob(job.id)}
                                className="stop-button"
                                title="Stop running job"
                              >
                                Stop
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
    </div>
  );
};

export default JobQueue;