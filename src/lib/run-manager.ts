import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { CommandRequest, CommandResponse, RunMetadata } from '../types/index.js';

export class RunManager {
  private rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  /**
   * Create a new run directory and write metadata
   */
  async createRun(
    agentName: string,
    command: string,
    request: CommandRequest,
    response: CommandResponse,
    durationMs: number
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const runPath = join(this.rootDir, 'runs', timestamp, agentName, command);

    await mkdir(runPath, { recursive: true });

    const metadata: RunMetadata = {
      timestamp: new Date().toISOString(),
      agent: agentName,
      command,
      duration_ms: durationMs,
      request,
      response,
    };

    await Promise.all([
      writeFile(join(runPath, 'request.json'), JSON.stringify(request, null, 2)),
      writeFile(join(runPath, 'response.json'), JSON.stringify(response, null, 2)),
      writeFile(join(runPath, 'metadata.json'), JSON.stringify(metadata, null, 2)),
    ]);

    return runPath;
  }

  /**
   * Write an artifact to a run directory
   */
  async writeArtifact(runPath: string, filename: string, content: string | Buffer): Promise<void> {
    const artifactPath = join(runPath, filename);
    await writeFile(artifactPath, content);
  }

  /**
   * Get relative run path for responses
   */
  getRelativePath(absolutePath: string): string {
    return absolutePath.replace(this.rootDir + '/', '');
  }
}
