import { spawn, type ChildProcess } from "node:child_process";

const TEST_PORT = 3100;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApi(url: string, attempts = 20): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
    }
    await wait(200);
  }

  throw new Error("API did not start in time");
}

describe("GET /main", () => {
  let apiProcess: ChildProcess;

  beforeAll(async () => {
    apiProcess = spawn("npm", ["run", "dev"], {
      env: { ...process.env, PORT: String(TEST_PORT) },
      stdio: "ignore",
    });

    await waitForApi(`${BASE_URL}/main`);
  });

  afterAll(() => {
    if (apiProcess && !apiProcess.killed) {
      apiProcess.kill("SIGTERM");
    }
  });

  it("returns true from API", async () => {
    const response = await fetch(`${BASE_URL}/main`);
    const body = (await response.json()) as { value: boolean };

    expect(response.status).toBe(200);
    expect(body.value).toBe(true);
  });
});
