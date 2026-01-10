declare module "node-cron" {
  export interface ScheduledTask {
    start(): void;
    stop(): void;
    destroy(): void;
  }

  export interface ScheduleOptions {
    scheduled?: boolean;
    timezone?: string;
    name?: string;
    recoverMissedExecutions?: boolean;
  }

  export function schedule(
    expression: string,
    func: () => void,
    options?: ScheduleOptions
  ): ScheduledTask;

  const cron: {
    schedule: typeof schedule;
  };

  export default cron;
}

