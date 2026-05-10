import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { TerraformJob, TerraformOutputLine } from '@hubblewave/control-plane-db';

export interface TerraformExecutionResult {
  output: TerraformOutputLine[];
}

@Injectable()
export class TerraformExecutor {
  private readonly terraformBinary: string;
  private readonly workspacesRoot: string;

  constructor(private readonly config: ConfigService) {
    this.terraformBinary = this.config.get<string>('TERRAFORM_BINARY', 'terraform');
    this.workspacesRoot = this.config.get<string>('TERRAFORM_WORKSPACES_ROOT', join(process.cwd(), 'terraform', 'workspaces'));
  }

  async plan(job: TerraformJob): Promise<TerraformExecutionResult> {
    return this.execute(job, ['plan', '-input=false', '-no-color']);
  }

  async apply(job: TerraformJob): Promise<TerraformExecutionResult> {
    return this.execute(job, ['apply', '-auto-approve', '-input=false', '-no-color']);
  }

  async destroy(job: TerraformJob): Promise<TerraformExecutionResult> {
    return this.execute(job, ['destroy', '-auto-approve', '-input=false', '-no-color']);
  }

  private async execute(job: TerraformJob, args: string[]): Promise<TerraformExecutionResult> {
    const init = await this.runTerraform(job, ['init', '-input=false', '-no-color', '-reconfigure']);
    const result = await this.runTerraform(job, args);
    return { output: [...init.output, ...result.output] };
  }

  private runTerraform(job: TerraformJob, args: string[]): Promise<TerraformExecutionResult> {
    return new Promise((resolve, reject) => {
      const output: TerraformOutputLine[] = [];
      const workspace = job.workspace || `${job.customerCode}-${job.environment}`;
      const cwd = join(this.workspacesRoot, workspace);
      if (!existsSync(cwd)) {
        const error = new Error(`Terraform workspace not found: ${cwd}`);
        (error as any).output = output;
        reject(error);
        return;
      }

      const proc = spawn(this.terraformBinary, args, {
        cwd,
        env: {
          ...process.env,
          TF_LOG: process.env.TF_LOG || 'WARN',
          TF_IN_AUTOMATION: 'true',
          TF_INPUT: '0',
        },
      });

      const pushLine = (level: TerraformOutputLine['level'], message: string) => {
        const line: TerraformOutputLine = {
          time: new Date().toISOString(),
          level,
          message,
        };
        output.push(line);
      };

      proc.stdout.on('data', (data: Buffer) => {
        data
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach((line) => pushLine('info', line));
      });

      proc.stderr.on('data', (data: Buffer) => {
        data
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach((line) => pushLine('error', line));
      });

      proc.on('error', (err) => {
        pushLine('error', err.message);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ output });
        } else {
          const error = new Error(`Terraform exited with code ${code}`);
          (error as any).output = output;
          reject(error);
        }
      });
    });
  }
}
