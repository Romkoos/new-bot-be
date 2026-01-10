/**
 * Response DTO for the health status use-case.
 */
export interface GetHealthStatusResponse {
  //Health status.
  status: "ok";
  // ISO-8601 timestamp representing when the status was produced.
  time: string;
}

