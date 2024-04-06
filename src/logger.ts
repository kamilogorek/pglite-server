export enum LogLevel {
  Error,
  Warn,
  Info,
  Debug,
}

export class Logger {
  private readonly prefix: string;

  constructor(
    private readonly logLevel: LogLevel = LogLevel.Info,
    prefix: string
  ) {
    this.prefix = `[${prefix}]:`;
  }

  public debug(...data: any[]) {
    if (this.logLevel < LogLevel.Debug) return;
    console.debug(this.prefix, ...data);
  }

  public info(...data: any[]) {
    if (this.logLevel < LogLevel.Info) return;
    console.info(this.prefix, ...data);
  }

  public warn(...data: any[]) {
    if (this.logLevel < LogLevel.Warn) return;
    console.warn(this.prefix, ...data);
  }

  public error(...data: any[]) {
    console.error(this.prefix, ...data);
  }
}
